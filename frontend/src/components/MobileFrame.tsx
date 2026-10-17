import type { FC, ReactNode } from "react";

const MobileFrame: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 overflow-hidden">
      <div className="relative w-[375px] h-[812px] bg-black rounded-[60px] border-[14px] border-zinc-900 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        {/* App Content */}
        <div className="h-[calc(100%-44px)] overflow-hidden bg-zinc-950 text-white">
          {children}
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full" />
      </div>

      {/* Instruction Overlay */}
      <div className="absolute bottom-8 text-center text-white/40 text-xs max-w-[340px] hidden lg:block">
        Open multiple tabs or windows to simulate different users • Real-time
        sync via BroadcastChannel
      </div>
    </div>
  );
};

export default MobileFrame;
