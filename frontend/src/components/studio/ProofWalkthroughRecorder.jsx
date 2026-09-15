import React, { useState, useRef, useEffect } from 'react';

export function ProofWalkthroughRecorder({ onWalkthroughReady, existingMedia = null }) {
  const [recordMode, setRecordMode] = useState('video'); // 'video' | 'audio'
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(existingMedia);
  const [errorMsg, setErrorMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const liveVideoRef = useRef(null);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    chunksRef.current = [];

    try {
      const constraints =
        recordMode === 'video'
          ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
          : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (recordMode === 'video' && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }

      // Check supported MIME type
      let mimeType = recordMode === 'video' ? 'video/webm;codecs=vp9,opus' : 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = recordMode === 'video' ? 'video/webm' : 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || (recordMode === 'video' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = recordMode === 'video' ? 'webm' : 'weba';
        const file = new File([blob], `proof_walkthrough_${Date.now()}.${ext}`, { type: mime });
        const url = URL.createObjectURL(blob);

        setRecordedBlob(file);
        setPreviewUrl(url);
        setIsRecording(false);
        setIsPaused(false);

        // Notify parent
        if (onWalkthroughReady) {
          onWalkthroughReady(file);
        }

        // Stop stream hardware tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(1000); // 1s slice
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      setErrorMsg('Microphone or Camera access was denied or not found. You can also upload a pre-recorded file below.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setRecordedBlob(file);
    setPreviewUrl(url);

    if (onWalkthroughReady) {
      onWalkthroughReady(file);
    }
  };

  const clearRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedBlob(null);
    setPreviewUrl(null);
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    if (onWalkthroughReady) {
      onWalkthroughReady(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#1A1A22', borderRadius: '10px', padding: '16px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>
            video_camera_front
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
              Proof Walkthrough Explanation
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
              Explain your lemmas and derivations in a recorded walkthrough
            </span>
          </div>
        </div>

        {/* Mode Selector (Video vs Audio) */}
        {!isRecording && !previewUrl && (
          <div style={{ display: 'inline-flex', backgroundColor: '#141418', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setRecordMode('video')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: recordMode === 'video' ? 'var(--primary)' : 'transparent',
                color: recordMode === 'video' ? '#000' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Video
            </button>
            <button
              type="button"
              onClick={() => setRecordMode('audio')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: recordMode === 'audio' ? 'var(--primary)' : 'transparent',
                color: recordMode === 'audio' ? '#000' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Audio Only
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#F87171', fontSize: '12px', marginBottom: '12px' }}>
          {errorMsg}
        </div>
      )}

      {/* Live Recording In-Progress */}
      {isRecording && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '16px 0' }}>
          {recordMode === 'video' && (
            <div style={{ width: '100%', maxWidth: '400px', height: '220px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', border: '1.5px solid var(--primary)' }}>
              <video ref={liveVideoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                display: 'inline-block',
                animation: isPaused ? 'none' : 'pulse 1.2s infinite',
              }}
            />
            <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
              {formatTime(duration)} {isPaused ? '(PAUSED)' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            {isPaused ? (
              <button type="button" onClick={resumeRecording} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span> Resume
              </button>
            ) : (
              <button type="button" onClick={pauseRecording} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pause</span> Pause
              </button>
            )}
            <button
              type="button"
              onClick={stopRecording}
              style={{
                padding: '6px 16px',
                backgroundColor: '#EF4444',
                color: '#FFF',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop</span> Finish Recording
            </button>
          </div>
        </div>
      )}

      {/* Recorded Media Preview */}
      {previewUrl && !isRecording && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0B0B0F', border: '1px solid var(--border)' }}>
            {recordMode === 'video' || (recordedBlob && recordedBlob.type?.startsWith('video/')) ? (
              <video src={previewUrl} controls playsInline style={{ width: '100%', maxHeight: '260px', display: 'block' }} />
            ) : (
              <div style={{ padding: '14px' }}>
                <audio src={previewUrl} controls style={{ width: '100%' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#34D399', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
              Walkthrough ready to publish
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={clearRecording}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '11.5px', color: '#F87171' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ready to Record or Upload */}
      {!isRecording && !previewUrl && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={startRecording}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {recordMode === 'video' ? 'videocam' : 'mic'}
            </span>
            Record {recordMode === 'video' ? 'Video' : 'Audio'} Walkthrough
          </button>

          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>or</span>

          <label
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
            Upload Walkthrough
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,audio/mp3,audio/wav,audio/m4a,audio/webm"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default ProofWalkthroughRecorder;
