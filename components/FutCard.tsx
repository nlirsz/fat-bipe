
import React, { memo } from 'react';
import { Player, Position } from '../types';

interface FutCardProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
}

export const FutCard: React.FC<FutCardProps> = memo(({ player, size = 'md' }) => {
  const rating = player.rating || 0;
  
  // Cores baseadas no rating
  let themeClass = "bg-[#c40000] border-[#ff3d3d] shadow-[0_10px_30px_rgba(196,0,0,0.4)]"; 
  let statLabelBg = "bg-[#8b0000]"; 
  let statValueBg = "bg-black/40";
  let blurBg = "bg-red-950/20"; 
  let glowColor = "shadow-[0_0_30px_rgba(255,61,61,0.3)]"; 

  if (rating === 0) {
    themeClass = "bg-[#1a1a1a] border-[#333] shadow-none opacity-80";
    statLabelBg = "bg-[#000]";
    statValueBg = "bg-white/5";
    blurBg = "bg-black/20";
    glowColor = "";
  } else if (rating < 90) { 
    themeClass = "bg-[#b38f00] border-[#ffd700] shadow-[0_10px_30px_rgba(179,143,0,0.3)]";
    statLabelBg = "bg-[#7a6200]";
    statValueBg = "bg-black/30";
    blurBg = "bg-[#7a6200]/20";
    glowColor = "shadow-[0_0_30px_rgba(255,215,0,0.2)]";
  }

  // Ajustes de tamanho mais agressivos para mobile
  const scale = size === 'sm' ? 'scale-100' : size === 'lg' ? 'scale-110' : 'scale-100';
  // 'sm' agora é projetado para caber em 2 colunas no mobile (~160px width)
  const containerSize = size === 'sm' ? 'w-[155px] h-[240px] md:w-48 md:h-[300px]' : 'w-64 h-[420px]';

  // Stats
  const stats = player.futStats || { pac: 0, sho: 0, pas: 0, dri: 0, def: 0, phy: 0 };
  const displayStats = [
    { label: 'FIN', value: stats.sho }, 
    { label: 'VIS', value: stats.pas }, 
    { label: 'DEC', value: stats.dri }, 
    { label: 'VIT', value: stats.pac }, 
    { label: 'EXP', value: stats.phy }, 
    { label: 'DEF', value: stats.def }, 
  ];

  const getPosInitials = (pos: Position) => {
    switch(pos) {
      case Position.GK: return 'GL';
      case Position.FWD: return 'ATA';
      case Position.MID: return 'ME';
      case Position.DEF: return 'ZAG';
      default: return 'CB';
    }
  };

  const appLogoUrl = "https://static.wixstatic.com/media/76f7c1_c1590890dabb4aa5a17eccf01b1481f7~mv2.png";

  return (
    <div className={`relative ${containerSize} transition-transform duration-300 transform-gpu ${scale} origin-top flex items-center justify-center select-none backface-hidden will-change-transform`}>
      <div className={`${themeClass} w-full h-full relative overflow-hidden rounded-lg md:rounded-xl border-2 md:border-4 flex flex-col ${glowColor} shadow-md`}>
        
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none z-20"></div>

        {/* Info Topo */}
        <div className={`absolute ${size === 'sm' ? 'top-3 left-3' : 'top-6 left-5'} z-40 flex flex-col items-center`}>
          <span className={`${size === 'sm' ? 'text-2xl md:text-3xl' : 'text-4xl'} font-black leading-none italic text-white`}>{rating}</span>
          <span className={`${size === 'sm' ? 'text-[8px] md:text-[9px]' : 'text-xs'} font-black uppercase tracking-[0.18em] mt-0.5 text-white/90`}>{getPosInitials(player.position)}</span>
          
          {size !== 'sm' && (
            <>
              <div className="mt-3 w-6 h-4 rounded-sm overflow-hidden border border-white/10">
                <img src="https://flagcdn.com/w80/br.png" className="w-full h-full object-cover" alt="BR" loading="lazy" />
              </div>
              <div className="mt-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 overflow-hidden shadow-sm">
                <img src={appLogoUrl} className="w-[84%] h-[84%] object-contain" alt="F.A.T." loading="lazy" />
              </div>
            </>
          )}
        </div>

        {/* Foto */}
        <div className="absolute top-0 left-0 w-full h-[78%] z-10">
      {player.avatarUrl ? (
                <img 
                    src={player.avatarUrl} 
                    alt={player.name} 
                    loading="lazy"
                    decoding="async"
          className="w-full h-full object-cover object-top filter contrast-[1.03] brightness-[1.03]"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/20">
          <span className={`${size === 'sm' ? 'text-4xl' : 'text-6xl'} opacity-10 grayscale`}>👤</span>
                </div>
            )}
        </div>

        {/* Nome */}
        <div className={`absolute ${size === 'sm' ? 'top-[60%]' : 'top-[58%]'} left-0 w-full z-50 text-center pointer-events-none transform -translate-y-1`}>
            <h3 className={`${size === 'sm' ? 'text-sm md:text-base' : 'text-xl'} font-black uppercase tracking-tight text-white px-2 truncate`}>
              {player.name}
            </h3>
            <div className={`w-10 md:w-16 h-[3px] bg-white/30 mx-auto mt-0.5 rounded-full`}></div>
        </div>

        {/* Stats */}
        <div className="mt-auto h-[38%] relative z-30">
            <div className={`absolute inset-0 backdrop-blur-md md:backdrop-blur-3xl ${blurBg} border-t border-white/10 [mask-image:linear-gradient(to_bottom,transparent,black_20%)]`}></div>
            
            <div className={`relative h-full flex flex-col items-center justify-center ${size === 'sm' ? 'p-2 pt-4' : 'p-4 pt-6'}`}>
                <div className={`grid grid-cols-2 w-full ${size === 'sm' ? 'gap-x-1 gap-y-1' : 'gap-x-2 gap-y-1'}`}>
                  {displayStats.map((s, idx) => (
                    <div key={idx} className={`flex items-center ${size === 'sm' ? 'h-5' : 'h-7'} overflow-hidden rounded-md shadow-sm border border-white/8`}>
                      <div className={`${statLabelBg} h-full px-2 flex items-center justify-center min-w-[26px]`}> 
                        <span className={`${size === 'sm' ? 'text-[8px]' : 'text-[10px]'} font-black text-white italic tracking-tighter`}>{s.label}</span>
                      </div>
                      <div className={`${statValueBg} h-full flex-1 flex items-center justify-center`}>
                        <span className={`${size === 'sm' ? 'text-[9px]' : 'text-sm'} font-black text-white tabular-nums`}>{s.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
        </div>

        <div className="absolute inset-0 border border-white/8 rounded-lg pointer-events-none z-[60]"></div>
      </div>
    </div>
  );
});
