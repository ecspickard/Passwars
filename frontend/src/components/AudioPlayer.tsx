import { useState, useRef, useEffect } from "react";

const TRACKS = [
  "/music/jazz1.mp3",
  "/music/jazz2.mp3",
  "/music/jazz3.mp3",
  "/music/jazz4.mp3",
  "/music/jazz5.mp3",
  "/music/jazz6.mp3",
  "/music/jazz7.mp3",
];

export function AudioPlayer() {
  const [isMuted, setIsMuted] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize with a random track on mount to truly shuffle
  useEffect(() => {
    setCurrentTrackIndex(Math.floor(Math.random() * TRACKS.length));
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
      } else {
        // Browsers scale volume linearly but human hearing is logarithmic.
        // We set it to 0.02 (2%) so it's truly a quiet ambient track.
        audioRef.current.volume = 0.035;
        audioRef.current.play().catch(err => {
          console.warn("Autoplay prevented by browser", err);
          setIsMuted(true);
        });
      }
    }
  }, [isMuted, currentTrackIndex]);

  const handleEnded = () => {
    // Pick a new random track that isn't the current one
    setCurrentTrackIndex((prev) => {
      let next;
      do {
        next = Math.floor(Math.random() * TRACKS.length);
      } while (next === prev && TRACKS.length > 1);
      return next;
    });
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <button
      onClick={toggleMute}
      className="flex items-center justify-center rounded-panel p-2 text-steel-400 hover:bg-ink-800 hover:text-gold-400 transition-colors"
      title={isMuted ? "Unmute Ambient Music" : "Mute Ambient Music"}
    >
      <audio
        ref={audioRef}
        src={TRACKS[currentTrackIndex]}
        onEnded={handleEnded}
        className="hidden"
      />
      {isMuted ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
