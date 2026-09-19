import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useWebSocket } from "../hooks/useWebSocket";

export function IncomingChallengeBanner() {
  const { incomingChallenge, dismissIncomingChallenge } = useNotifications();
  const { send } = useWebSocket();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (incomingChallenge) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(dismissIncomingChallenge, 300); // Wait for exit animation
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [incomingChallenge, dismissIncomingChallenge]);

  if (!incomingChallenge) return null;

  const { challengeId, challengerName, challengerService, defenderService } = incomingChallenge;

  const handleAccept = () => {
    send({ type: "accept_challenge", challenge_id: challengeId });
    setIsVisible(false);
    setTimeout(() => {
      dismissIncomingChallenge();
      navigate(`/challenges/${challengeId}`);
    }, 300);
  };

  const handleDecline = () => {
    send({ type: "deny_challenge", challenge_id: challengeId });
    setIsVisible(false);
    setTimeout(dismissIncomingChallenge, 300);
  };

  return (
    <div 
      role="alert" 
      aria-live="assertive" 
      className="fixed inset-x-0 top-6 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div 
        className={`pointer-events-auto panel flex w-full max-w-sm flex-col gap-3 border-gold-500/60 bg-ink-900 p-4 shadow-xl transition-all duration-500 ease-out transform ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div>
          <p className="font-display text-base text-gold-400">Challenge from {challengerName}</p>
          <p className="text-sm text-steel-400">
            Their <span className="text-parchment-100">{challengerService}</span> for your{" "}
            <span className="text-parchment-100">{defenderService}</span>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-end">
          <button type="button" className="btn-ghost py-1 px-3 text-sm" onClick={handleDecline}>
            Decline
          </button>
          <button type="button" className="btn-gold py-1 px-3 text-sm" onClick={handleAccept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
