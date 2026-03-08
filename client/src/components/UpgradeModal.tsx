import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { Crown, X, Check, Smartphone } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

type Stage = "select" | "qrcode" | "success";
type Plan = "monthly" | "yearly";
type Channel = "wechat" | "alipay";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const PLANS: { key: Plan; label: string; price: string; badge?: string }[] = [
  { key: "monthly", label: "Monthly", price: "9.9" },
  { key: "yearly", label: "Yearly", price: "99", badge: "Save 17%" },
];

const FEATURES: { name: string; free: boolean; pro: boolean }[] = [
  { name: "Basic task management", free: true, pro: true },
  { name: "5 categories", free: true, pro: true },
  { name: "Unlimited categories", free: false, pro: true },
  { name: "Notion bidirectional sync", free: false, pro: true },
  { name: "File attachments", free: false, pro: true },
  { name: "Priority support", free: false, pro: true },
];

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const [stage, setStage] = useState<Stage>("select");
  const [plan, setPlan] = useState<Plan>("yearly");
  const [channel, setChannel] = useState<Channel>("wechat");
  const [qrUrl, setQrUrl] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setStage("select");
    setPlan("yearly");
    setChannel("wechat");
    setQrUrl("");
    setOrderNo("");
    setError("");
    setLoading(false);
    stopPolling();
  }, [stopPolling]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handlePay = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await api.createPayment(plan, channel);
      setQrUrl(result.qr_url);
      setOrderNo(result.order_no);
      setStage("qrcode");
      startPolling(result.order_no);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create payment",
      );
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (order: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const status = await api.getPaymentStatus(order);
        if (status.status === "paid") {
          stopPolling();
          setStage("success");
          // Refresh user data to update subscription status
          try {
            const user = await api.getMe();
            useAuthStore.setState({ user });
          } catch {
            // Non-critical: subscription will refresh on next load
          }
        }
      } catch {
        // Polling error is non-critical, will retry next interval
      }
    }, 3000);
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/50 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden relative">
                  {/* Close button */}
                  <Dialog.Close asChild>
                    <button className="absolute top-3 right-3 z-10 p-1 rounded-full bg-white/80 hover:bg-white text-gray-500 hover:text-gray-700 transition-colors">
                      <X size={18} />
                    </button>
                  </Dialog.Close>

                  {stage === "select" && (
                    <SelectView
                      plan={plan}
                      setPlan={setPlan}
                      channel={channel}
                      setChannel={setChannel}
                      onPay={handlePay}
                      loading={loading}
                      error={error}
                    />
                  )}
                  {stage === "qrcode" && (
                    <QrCodeView
                      qrUrl={qrUrl}
                      channel={channel}
                      onBack={() => {
                        stopPolling();
                        setStage("select");
                      }}
                    />
                  )}
                  {stage === "success" && (
                    <SuccessView onClose={handleClose} />
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function SelectView({
  plan,
  setPlan,
  channel,
  setChannel,
  onPay,
  loading,
  error,
}: {
  plan: Plan;
  setPlan: (p: Plan) => void;
  channel: Channel;
  setChannel: (c: Channel) => void;
  onPay: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-400 px-6 py-6 text-white text-center">
        <Crown size={36} className="mx-auto mb-2 fill-white/30" />
        <h2 className="text-xl font-bold">Upgrade to Pro</h2>
        <p className="text-sm text-white/80 mt-1">
          Unlock all features and boost your productivity
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Feature comparison */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Feature</th>
                <th className="pb-2 font-medium w-14 text-center">Free</th>
                <th className="pb-2 font-medium w-14 text-center">Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.name} className="border-t border-gray-50">
                  <td className="py-2 text-gray-600">{f.name}</td>
                  <td className="py-2 text-center">
                    {f.free ? (
                      <Check size={16} className="inline text-green-500" />
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    <Check size={16} className="inline text-orange-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Plan selection */}
        <div className="flex gap-3">
          {PLANS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlan(p.key)}
              className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${
                plan === p.key
                  ? "border-orange-400 bg-orange-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="text-xs text-gray-500 font-medium">
                {p.label}
              </div>
              <div className="text-lg font-bold text-gray-800 mt-0.5">
                <span className="text-xs font-normal">&#165;</span>
                {p.price}
              </div>
              {p.badge && (
                <span className="inline-block mt-1 text-[10px] bg-orange-400 text-white px-1.5 py-0.5 rounded-full font-medium">
                  {p.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Channel selection */}
        <div className="flex gap-3">
          <button
            onClick={() => setChannel("wechat")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all ${
              channel === "wechat"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <Smartphone size={16} />
            WeChat
          </button>
          <button
            onClick={() => setChannel("alipay")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-all ${
              channel === "alipay"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <Smartphone size={16} />
            Alipay
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Pay button */}
        <button
          onClick={onPay}
          disabled={loading}
          className="w-full bg-gradient-to-r from-red-500 to-orange-400 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Pay Now"}
        </button>
      </div>
    </>
  );
}

function QrCodeView({
  qrUrl,
  channel,
  onBack,
}: {
  qrUrl: string;
  channel: Channel;
  onBack: () => void;
}) {
  return (
    <>
      <div className="bg-gradient-to-r from-red-500 to-orange-400 px-6 py-5 text-white text-center">
        <h2 className="text-lg font-bold">Scan to Pay</h2>
        <p className="text-sm text-white/80 mt-1">
          Open {channel === "wechat" ? "WeChat" : "Alipay"} and scan the QR
          code
        </p>
      </div>

      <div className="px-6 py-8 flex flex-col items-center space-y-5">
        <div className="bg-gray-50 rounded-xl p-4">
          <img
            src={qrUrl}
            alt="Payment QR Code"
            className="w-48 h-48 object-contain"
          />
        </div>
        <p className="text-xs text-gray-400 text-center">
          Waiting for payment confirmation...
        </p>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back to plan selection
        </button>
      </div>
    </>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-6 py-10 flex flex-col items-center space-y-4 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <Check size={32} className="text-green-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-800">Welcome to Pro!</h2>
      <p className="text-sm text-gray-500">
        Your subscription is now active. Enjoy all the premium features!
      </p>
      <button
        onClick={onClose}
        className="mt-2 bg-gradient-to-r from-red-500 to-orange-400 text-white font-semibold py-2.5 px-8 rounded-xl hover:opacity-90 transition-opacity"
      >
        Get Started
      </button>
    </div>
  );
}
