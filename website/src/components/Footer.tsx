import { GotionLogo } from "./GotionLogo";

export function Footer() {
  return (
    <footer className="border-t-2 border-ink/10 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
        <div className="flex items-center gap-2">
          <GotionLogo className="w-6 h-6" />
          <span className="font-marker text-xl">Gotion</span>
        </div>
        <div className="flex items-center gap-8 font-hand text-lg font-bold">
          <a href="#" className="hover:text-ink transition-colors">Privacy</a>
          <a href="#" className="hover:text-ink transition-colors">Terms</a>
          <a href="#" className="hover:text-ink transition-colors">Support</a>
          <a href="#" className="hover:text-ink transition-colors">Twitter</a>
        </div>
        <p className="font-hand text-lg">&copy; 2026 Gotion</p>
      </div>
    </footer>
  );
}
