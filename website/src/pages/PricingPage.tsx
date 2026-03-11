import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";

export function PricingPage() {
  const navigate = useNavigate();
  const [billedYearly, setBilledYearly] = useState(true);

  const tiers = [
    {
      name: "Beginner",
      price: 0,
      description: "Start organizing your life for free",
      features: [
        "5 personal projects",
        "Smart quick add",
        "Task reminders",
        "Flexible list & board layouts",
        "3 filter views",
        "1 week activity history"
      ],
      cta: "Always free",
      highlight: false,
      color: "border-ink shadow-[8px_8px_0px_0px_#e5e7eb]",
      hoverColor: "hover:shadow-[10px_10px_0px_0px_#e5e7eb]",
      buttonColor: "bg-white hover:bg-gray-50"
    },
    {
      name: "Pro",
      price: billedYearly ? 4 : 5,
      description: "Organize your work and life",
      features: [
        "300 personal projects",
        "Calendar layout",
        "Task duration",
        "Custom task reminders",
        "150 filter views",
        "Unlimited activity history",
        "Task Assist AI"
      ],
      cta: "Get Started",
      highlight: true,
      color: "border-ink shadow-[8px_8px_0px_0px_#fcd34d]",
      hoverColor: "hover:shadow-[10px_10px_0px_0px_#fcd34d]",
      buttonColor: "bg-ink text-white shadow-[4px_4px_0px_0px_#fcd34d] hover:shadow-[2px_2px_0px_0px_#fcd34d]"
    },
    {
      name: "Business",
      price: billedYearly ? 6 : 8,
      description: "Manage your teamwork, too",
      features: [
        "A shared team workspace",
        "Up to 500 team projects",
        "Calendar layout for team projects",
        "Granular team activity logs",
        "Shared templates",
        "1000 team members & guests"
      ],
      cta: "Try for free",
      highlight: false,
      badge: "Designed for teams!",
      color: "border-ink shadow-[8px_8px_0px_0px_#a5f3fc]",
      hoverColor: "hover:shadow-[10px_10px_0px_0px_#a5f3fc]",
      buttonColor: "bg-white hover:bg-cyan-50"
    }
  ];

  return (
    <>
      <div className="min-h-screen pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-40 left-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-40 right-10 w-64 h-64 bg-tertiary/20 rounded-full blur-3xl -z-10"></div>

        <div className="max-w-7xl mx-auto space-y-16">
          {/* Header */}
          <div className="text-center space-y-6">
            <h1 className="text-6xl font-marker text-ink transform -rotate-1">
              Simple pricing for <br />
              <span className="relative inline-block">
                everyone.
                <span className="absolute bottom-2 left-0 w-full h-4 bg-tertiary/60 -z-10 transform -skew-x-6 rounded-sm"></span>
              </span>
            </h1>

            <div className="flex items-center justify-center gap-4 pt-8">
              <span className={`font-hand text-xl font-bold transition-colors ${!billedYearly ? 'text-ink' : 'text-ink/40'}`}>Billed Monthly</span>
              <button
                onClick={() => setBilledYearly(!billedYearly)}
                className="w-16 h-8 bg-ink rounded-full relative transition-colors"
              >
                <motion.div
                  animate={{ x: billedYearly ? 32 : 4 }}
                  className="w-6 h-6 bg-white rounded-full absolute top-1"
                />
              </button>
              <span className={`font-hand text-xl font-bold transition-colors ${billedYearly ? 'text-ink' : 'text-ink/40'}`}>
                Billed Yearly
                <span className="ml-2 text-sm text-green-600 transform rotate-3 inline-block font-marker">Save 20%</span>
              </span>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white border-2 border-ink rounded-[2rem] p-8 space-y-8 flex flex-col ${tier.color} hover:translate-x-[-2px] hover:translate-y-[-2px] ${tier.hoverColor} transition-all`}
              >
                {tier.badge && (
                  <div className="absolute -top-4 right-8 bg-secondary border-2 border-ink px-4 py-1 rounded-full font-bold font-hand text-sm transform rotate-2 shadow-sm">
                    {tier.badge}
                  </div>
                )}

                {tier.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-yellow-100/90 rotate-1 border-l border-r border-white/50 shadow-sm"></div>
                )}

                <div className="space-y-4">
                  <h3 className="font-marker text-3xl">{tier.name}</h3>
                  <p className="font-hand text-ink/60 h-12">{tier.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-marker text-5xl">${tier.price}</span>
                  <span className="font-hand text-ink/60">USD</span>
                </div>

                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className={`w-full py-3 rounded-xl border-2 border-ink font-bold text-lg transition-all ${tier.buttonColor} ${tier.highlight ? 'hover:translate-x-[2px] hover:translate-y-[2px]' : ''}`}
                >
                  {tier.cta}
                </button>

                <div className="space-y-4 flex-1">
                  <p className="font-bold font-hand text-sm uppercase tracking-wider opacity-60">
                    {tier.name === "Beginner" ? "An account with:" : `Everything in ${tiers[index - 1].name}, plus:`}
                  </p>
                  <ul className="space-y-3">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 font-hand text-lg">
                        <Check className="w-5 h-5 text-green-600 shrink-0 mt-1" />
                        <span className="leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto pt-16 space-y-8">
            <h2 className="text-4xl font-marker text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-6">
              <div className="bg-white border-2 border-ink rounded-2xl p-6 shadow-[4px_4px_0px_0px_#fbcfe8]">
                <h3 className="font-bold font-hand text-xl mb-2">Can I switch plans later?</h3>
                <p className="font-hand text-ink/70">Absolutely! You can upgrade or downgrade your plan at any time from your account settings.</p>
              </div>
              <div className="bg-white border-2 border-ink rounded-2xl p-6 shadow-[4px_4px_0px_0px_#a5f3fc]">
                <h3 className="font-bold font-hand text-xl mb-2">Do you offer student discounts?</h3>
                <p className="font-hand text-ink/70">Yes! Students and educators get 50% off the Pro plan. Just contact support with your .edu email.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
