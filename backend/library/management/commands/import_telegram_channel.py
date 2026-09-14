import os
import re
import asyncio
import tempfile
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.core.files import File
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from library.models import Resource, Category, Tag


COURSE_CODE_REGEX = re.compile(
    r'\b(?:MTH|MAT|STA|PHY|CSC|COS|CHM)\s*([1-5])\d{2}\b',
    re.IGNORECASE
)

EXPLICIT_LEVEL_REGEX = re.compile(
    r'\b([1-5])00\s*(?:lvl|level|lv|l)\b',
    re.IGNORECASE
)

LEVEL_TOPIC_KEYWORDS = {
    Resource.LEVEL_100: [
        'calculus', 'precalculus', 'pre calculus', 'algebra and trigonometry',
        'algebra & trigonometry', 'elementary algebra', 'trigonometry',
        'coordinate geometry', 'introductory mathematics', 'general mathematics',
        'intro to computer', 'elementary mechanics', 'mth 1', 'mat 1', 'sta 1'
    ],
    Resource.LEVEL_200: [
        'linear algebra', 'elementary differential equations', 'ode', 'real analysis i',
        'mathematical methods', 'vector analysis', 'vector calculus', 'discrete mathematics',
        'mth 2', 'mat 2', 'sta 2'
    ],
    Resource.LEVEL_300: [
        'abstract algebra', 'modern algebra', 'groups and rings', 'group theory', 'ring theory',
        'real analysis ii', 'complex analysis', 'metric spaces', 'numerical analysis',
        'pde', 'partial differential equations', 'linear programming', 'mth 3', 'mat 3', 'sta 3'
    ],
    Resource.LEVEL_400: [
        'functional analysis', 'topology', 'general topology', 'differential geometry',
        'measure theory', 'lebesgue', 'fluid dynamics', 'operations research',
        'quantum mechanics', 'mth 4', 'mat 4', 'sta 4'
    ],
    Resource.LEVEL_500: [
        'advanced fluid', 'perturbation methods', 'dynamical systems',
        'stochastic processes', 'advanced topology', 'tensor analysis', 'mth 5', 'mat 5'
    ],
}


def normalize_text(text: str) -> str:
    # Replace non-alphanumeric characters with spaces and lowercase
    cleaned = re.sub(r'[^a-zA-Z0-9]+', ' ', text).lower()
    return f" {re.sub(r'\s+', ' ', cleaned).strip()} "


def classify_level(filename: str, caption: str = '') -> str:
    raw_combined = f"{filename} {caption}"
    norm = normalize_text(raw_combined)

    # 1. Check Course Code (e.g. MTH 201, MAT 101, STA 311)
    match = COURSE_CODE_REGEX.search(raw_combined)
    if match:
        digit = match.group(1)
        level_map = {
            '1': Resource.LEVEL_100,
            '2': Resource.LEVEL_200,
            '3': Resource.LEVEL_300,
            '4': Resource.LEVEL_400,
            '5': Resource.LEVEL_500,
        }
        if digit in level_map:
            return level_map[digit]

    # 2. Check Explicit Level Mention (e.g. "100L", "200 level", "400lvl")
    match_lvl = EXPLICIT_LEVEL_REGEX.search(norm)
    if match_lvl:
        digit = match_lvl.group(1)
        level_map = {
            '1': Resource.LEVEL_100,
            '2': Resource.LEVEL_200,
            '3': Resource.LEVEL_300,
            '4': Resource.LEVEL_400,
            '5': Resource.LEVEL_500,
        }
        if digit in level_map:
            return level_map[digit]

    # 3. Check Academic Topic Keywords
    for lvl, keywords in LEVEL_TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in norm:
                return lvl

    return Resource.LEVEL_GENERAL


def classify_resource_type(filename: str, caption: str = '') -> str:
    norm = normalize_text(f"{filename} {caption}")
    if any(term in norm for term in [' past question ', ' past questions ', ' pastquestion ', ' pq ', ' pqs ', ' exam ', ' test ', ' quiz ', ' mid term ', ' solution ']):
        return Resource.TYPE_PROBLEM
    if any(term in norm for term in [' textbook ', ' edition ', ' author ', ' springer ', ' rudin ', ' stewart ', ' kreyszig ', ' spivak ', ' hall ', ' macmillan ', ' cambridge ', ' wiley ']):
        return Resource.TYPE_TEXTBOOK
    if any(term in norm for term in [' formula ', ' cheat sheet ', ' cheatsheet ', ' summary table ']):
        return Resource.TYPE_FORMULA
    return Resource.TYPE_NOTE


def determine_category_name(filename: str, caption: str = '') -> str:
    combined = f"{filename} {caption}".lower()
    if any(t in combined for t in ['statistic', 'probability', 'sta ', 'sta_', 'distribution', 'regression']):
        return "Statistics & Probability"
    if any(t in combined for t in ['fluid', 'mechanics', 'numerical', 'applied', 'differential equations', 'ode', 'pde', 'methods']):
        return "Applied Mathematics"
    if any(t in combined for t in ['algebra', 'topology', 'analysis', 'metric space', 'geometry', 'number theory', 'group', 'ring']):
        return "Pure Mathematics"
    if any(t in combined for t in ['computer', 'algorithm', 'csc', 'cos', 'python', 'programming']):
        return "Computational Mathematics"
    return "General Mathematics"


def clean_title_from_filename(filename: str) -> str:
    # Remove extension
    stem = Path(filename).stem
    # Replace underscores/hyphens with spaces
    title = re.sub(r'[_\-]+', ' ', stem).strip()
    # Normalize extra whitespace
    title = re.sub(r'\s+', ' ', title)
    return title.title() if title.islower() else title


class Command(BaseCommand):
    help = "Bulk import academic documents from a public Telegram channel and classify them by level (100L-500L)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--channel',
            type=str,
            required=True,
            help="Username, link or ID of the Telegram channel (e.g. @my_math_channel or https://t.me/my_math_channel)"
        )
        parser.add_argument(
            '--api-id',
            type=str,
            default=os.environ.get('TELEGRAM_API_ID', ''),
            help="Telegram API ID (or set TELEGRAM_API_ID env variable)"
        )
        parser.add_argument(
            '--api-hash',
            type=str,
            default=os.environ.get('TELEGRAM_API_HASH', ''),
            help="Telegram API Hash (or set TELEGRAM_API_HASH env variable)"
        )
        parser.add_argument(
            '--bot-token',
            type=str,
            default=os.environ.get('TELEGRAM_BOT_TOKEN', ''),
            help="Optional Telegram Bot Token for bot authentication"
        )
        parser.add_argument(
            '--session',
            type=str,
            default='mathify_telegram_session',
            help="Name of session file for Telethon"
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=300,
            help="Maximum messages to scan in the channel (default: 300)"
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Preview documents and level classification without downloading or saving to database"
        )
        parser.add_argument(
            '--uploader',
            type=str,
            default=None,
            help="Username or email of the Mathify user to assign resources to"
        )

    def handle(self, *args, **options):
        channel_identifier = options['channel'].strip()
        api_id = options['api_id']
        api_hash = options['api_hash']
        bot_token = options['bot_token']
        session_name = options['session']
        limit = options['limit']
        dry_run = options['dry_run']
        uploader_param = options['uploader']

        # Clean channel identifier (strip https://t.me/ or t.me/)
        if 't.me/' in channel_identifier:
            channel_identifier = channel_identifier.split('t.me/')[-1].strip('/')

        self.stdout.write(self.style.SUCCESS(f"=== Mathify Telegram Ingest Engine ==="))
        self.stdout.write(f"Target Channel: {channel_identifier}")
        self.stdout.write(f"Scan Limit: {limit} messages")
        self.stdout.write(f"Mode: {'DRY RUN (Preview Only)' if dry_run else 'LIVE IMPORT'}")

        if not api_id or not api_hash:
            raise CommandError(
                "Missing Telegram API credentials! Please supply --api-id and --api-hash, "
                "or set TELEGRAM_API_ID and TELEGRAM_API_HASH in your environment.\n"
                "You can get them free at https://my.telegram.org (API Development tools)."
            )

        try:
            api_id = int(api_id)
        except ValueError:
            raise CommandError("TELEGRAM_API_ID must be an integer.")

        User = get_user_model()
        uploader = None
        if not dry_run:
            if uploader_param:
                uploader = User.objects.filter(username=uploader_param).first() or \
                           User.objects.filter(email=uploader_param).first()
                if not uploader:
                    raise CommandError(f"Specified uploader '{uploader_param}' not found.")
            else:
                uploader = User.objects.filter(is_superuser=True).first() or User.objects.first()
                if not uploader:
                    raise CommandError("No users exist in the database to assign resources to.")
            self.stdout.write(f"Assigning resources to: {uploader.get_username()} (ID: {uploader.id})")

        # Run async ingestion
        try:
            asyncio.run(
                self._run_telegram_import(
                    api_id=api_id,
                    api_hash=api_hash,
                    bot_token=bot_token,
                    session_name=session_name,
                    channel_identifier=channel_identifier,
                    limit=limit,
                    dry_run=dry_run,
                    uploader=uploader
                )
            )
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\nImport aborted by user."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during import: {e}"))
            raise

    async def _run_telegram_import(
        self,
        api_id: int,
        api_hash: str,
        bot_token: str,
        session_name: str,
        channel_identifier: str,
        limit: int,
        dry_run: bool,
        uploader
    ):
        try:
            from telethon import TelegramClient
            from telethon.tl.types import MessageMediaDocument, DocumentAttributeFilename
        except ImportError:
            raise CommandError("Telethon is not installed. Please install it with 'pip install telethon'.")

        client = TelegramClient(session_name, api_id, api_hash)
        
        if bot_token:
            self.stdout.write("Authenticating with Bot Token...")
            await client.start(bot_token=bot_token)
        else:
            self.stdout.write("Connecting to Telegram...")
            await client.start()

        self.stdout.write(self.style.SUCCESS("Connected to Telegram successfully."))

        try:
            entity = await client.get_entity(channel_identifier)
            self.stdout.write(self.style.SUCCESS(f"Resolved channel: {getattr(entity, 'title', channel_identifier)}"))
        except Exception as err:
            await client.disconnect()
            raise CommandError(f"Failed to resolve channel '{channel_identifier}': {err}")

        stats = {
            'scanned': 0,
            'documents': 0,
            'skipped_existing': 0,
            'imported': 0,
            'levels': {
                Resource.LEVEL_100: 0,
                Resource.LEVEL_200: 0,
                Resource.LEVEL_300: 0,
                Resource.LEVEL_400: 0,
                Resource.LEVEL_500: 0,
                Resource.LEVEL_GENERAL: 0,
            }
        }

        # Cache category lookups to reduce queries
        categories_cache = {}

        self.stdout.write("\nFetching messages and parsing academic materials...")

        async for message in client.iter_messages(entity, limit=limit):
            stats['scanned'] += 1

            if not message.media or not isinstance(message.media, MessageMediaDocument):
                continue

            doc = message.media.document
            stats['documents'] += 1

            # Extract filename from attributes
            filename = "document"
            for attr in doc.attributes:
                if isinstance(attr, DocumentAttributeFilename):
                    filename = attr.file_name
                    break

            # Filter non-academic extensions if needed (e.g. ignore audio or voice files)
            ext = Path(filename).suffix.lower()
            if ext in ['.ogg', '.oga', '.mp3', '.wav', '.apk']:
                continue

            caption = message.message or ""
            doc_size = doc.size

            # Check if already imported
            if not dry_run and Resource.objects.filter(telegram_message_id=message.id).exists():
                stats['skipped_existing'] += 1
                self.stdout.write(f"  [SKIPPED] Msg #{message.id} ({filename}) already in library.")
                continue

            # Classify level, resource type, and category
            level = classify_level(filename, caption)
            stats['levels'][level] += 1
            resource_type = classify_resource_type(filename, caption)
            category_name = determine_category_name(filename, caption)
            title = clean_title_from_filename(filename)

            level_badge = f"[{level}L]" if level != Resource.LEVEL_GENERAL else "[General]"
            size_mb = doc_size / (1024 * 1024)

            self.stdout.write(
                f"  {level_badge:9} | Type: {resource_type:12} | Size: {size_mb:5.1f}MB | {filename}"
            )

            if dry_run:
                stats['imported'] += 1
                continue

            # In LIVE mode, download and create Resource record
            try:
                # Ensure category exists
                if category_name not in categories_cache:
                    cat, _ = Category.objects.get_or_create(
                        slug=slugify(category_name),
                        defaults={'name': category_name, 'description': f'{category_name} materials'}
                    )
                    categories_cache[category_name] = cat
                category = categories_cache[category_name]

                # Download file to a temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
                    tmp_path = tmp_file.name

                await client.download_media(message, file=tmp_path)

                # Save resource to Mathify
                with open(tmp_path, 'rb') as f:
                    django_file = File(f, name=filename)
                    resource = Resource.objects.create(
                        title=title[:290],
                        description=caption[:1000] if caption else f"Imported from {getattr(entity, 'title', channel_identifier)}",
                        resource_type=resource_type,
                        level=level,
                        file=django_file,
                        file_size_bytes=doc_size,
                        category=category,
                        uploaded_by=uploader,
                        telegram_message_id=message.id
                    )

                # Clean up local temporary file
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

                stats['imported'] += 1
                self.stdout.write(self.style.SUCCESS(f"    -> Saved Resource ID {resource.id} ({title})"))

            except Exception as dl_err:
                self.stdout.write(self.style.ERROR(f"    -> Failed to download/save Msg #{message.id}: {dl_err}"))

        await client.disconnect()

        # Print Final Summary
        self.stdout.write("\n" + "=" * 55)
        self.stdout.write(self.style.SUCCESS("=== Telegram Ingestion Summary ==="))
        self.stdout.write(f"Total Messages Scanned : {stats['scanned']}")
        self.stdout.write(f"Total Documents Found  : {stats['documents']}")
        if not dry_run:
            self.stdout.write(f"Already In Library     : {stats['skipped_existing']}")
            self.stdout.write(f"Newly Imported         : {stats['imported']}")
        else:
            self.stdout.write(f"Previewed for Import   : {stats['imported']}")
        
        self.stdout.write("\nLevel Breakdown:")
        for lvl in [Resource.LEVEL_100, Resource.LEVEL_200, Resource.LEVEL_300, Resource.LEVEL_400, Resource.LEVEL_500, Resource.LEVEL_GENERAL]:
            badge = f"{lvl}L" if lvl != Resource.LEVEL_GENERAL else "General Reference"
            count = stats['levels'][lvl]
            self.stdout.write(f"  - {badge:18}: {count} materials")
        self.stdout.write("=" * 55 + "\n")
