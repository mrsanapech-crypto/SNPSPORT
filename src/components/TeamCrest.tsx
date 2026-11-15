import React, { useState, useEffect } from 'react';
import { Trophy, Globe, Shield } from 'lucide-react';
import {
  getTeamLogoUrl,
  getLeagueLogoUrl,
  getTeamMirrorLogoUrl,
  getLeagueMirrorLogoUrl,
  splitTextForHighlight,
} from '../utils/footballLogic';

interface HighlightedTextProps {
  text: string;
  query?: string;
  forceHighlight?: boolean;
  className?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = React.memo(({
  text,
  query,
  forceHighlight = false,
  className = '',
}) => {
  const segments = splitTextForHighlight(text, query);
  const hasDirectSegmentMatch = segments.some((s) => s.highlighted);

  if (!hasDirectSegmentMatch && forceHighlight && query && query.trim()) {
    return (
      <span className={className}>
        <mark
          data-testid="search-highlight"
          className="bg-[#fbbf24]/25 text-[#fbbf24] px-1 py-0.5 rounded font-bold ring-1 ring-[#fbbf24]/40"
        >
          {text}
        </mark>
      </span>
    );
  }

  return (
    <span className={className}>
      {segments.map((seg, idx) =>
        seg.highlighted ? (
          <mark
            key={idx}
            data-testid="search-highlight"
            className="bg-[#fbbf24]/30 text-[#fbbf24] px-0.5 rounded font-extrabold ring-1 ring-[#fbbf24]/50"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
});

interface TeamCrestProps {
  shortCode: string;
  primaryColor: string;
  secondaryColor?: string;
  isNational?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  teamName?: string;
  logoUrl?: string;
}

export const TeamCrest: React.FC<TeamCrestProps> = React.memo(({
  shortCode,
  primaryColor,
  secondaryColor = '#ffffff',
  size = 'md',
  teamName,
  logoUrl,
}) => {
  // Stage 0: primary resolved logo URL (or direct API logoUrl)
  // Stage 1: high-res transparent mirror crest if primary fails
  // Stage 2: generic football shield icon fallback (never raw text abbreviations)
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const dictionaryPrimary = getTeamLogoUrl(shortCode, teamName);
  const dictionaryMirror = getTeamMirrorLogoUrl(shortCode, teamName);
  const primaryLogoUrl = dictionaryPrimary || logoUrl || dictionaryMirror;
  const mirrorLogoUrl =
    dictionaryMirror && dictionaryMirror !== primaryLogoUrl
      ? dictionaryMirror
      : logoUrl && logoUrl !== primaryLogoUrl
      ? logoUrl
      : null;

  useEffect(() => {
    setStage(0);
  }, [shortCode, teamName, logoUrl]);

  const activeSrc =
    stage === 0
      ? primaryLogoUrl || mirrorLogoUrl
      : stage === 1
      ? mirrorLogoUrl
      : null;

  const sizeMap = {
    sm: 'w-6 h-6 text-[9px] p-0.5',
    md: 'w-9 h-9 text-[11px] p-1',
    lg: 'w-12 h-12 text-xs p-1.5',
    xl: 'w-14 h-14 text-sm p-1.5',
  };

  const shieldIconSizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-7 h-7',
  };

  if (activeSrc && stage < 2) {
    return (
      <div
        title={`${teamName || shortCode} crest`}
        className={`${sizeMap[size]} relative rounded-full flex items-center justify-center shrink-0 select-none bg-white/95 border border-white/30 shadow-[0_2px_10px_rgba(0,0,0,0.45)] overflow-hidden transition-transform duration-300 group-hover:scale-110 hover:scale-110 hover:-rotate-3`}
      >
        <img
          src={activeSrc}
          alt={`${teamName || shortCode} logo`}
          data-logo-source={stage === 0 ? 'football-logos.cc' : 'football-logos-mirror'}
          loading="eager"
          onError={() => {
            if (stage === 0 && mirrorLogoUrl && activeSrc !== mirrorLogoUrl) {
              setStage(1);
            } else {
              setStage(2);
            }
          }}
          className="w-full h-full object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]"
        />
      </div>
    );
  }

  return (
    <div
      title={`${teamName || 'Club'} shield`}
      className={`${sizeMap[size]} relative rounded-full flex items-center justify-center shrink-0 select-none shadow-sm border border-white/20 overflow-hidden bg-[#171d2b] transition-transform duration-300 group-hover:scale-110 hover:scale-110`}
      style={{
        background: `linear-gradient(135deg, ${primaryColor || '#1e293b'} 0%, #121622 85%, ${secondaryColor || '#f59e0b'}44 100%)`,
      }}
      aria-label={`${teamName || 'Football Club'} crest`}
    >
      <Shield
        className={`${shieldIconSizeMap[size]} text-[#f8fafc] fill-white/15 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`}
      />
    </div>
  );
});

interface LeagueBadgeProps {
  leagueId: string;
  badgeColor: string;
  category: 'international' | 'national';
  size?: 'sm' | 'md';
}

export const LeagueBadge: React.FC<LeagueBadgeProps> = ({
  leagueId,
  badgeColor,
  category,
  size = 'md',
}) => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const primaryLogoUrl = getLeagueLogoUrl(leagueId);
  const mirrorLogoUrl = getLeagueMirrorLogoUrl(leagueId);

  const activeSrc =
    stage === 0
      ? mirrorLogoUrl || primaryLogoUrl
      : stage === 1
      ? primaryLogoUrl
      : null;

  const dims = size === 'sm' ? 'w-6 h-6 p-0.5' : 'w-9 h-9 p-1';
  const iconDims = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (activeSrc && stage < 2) {
    return (
      <div
        title={`${leagueId.toUpperCase()} logo (football-logos.cc)`}
        className={`${dims} rounded-full flex items-center justify-center shrink-0 bg-white/95 border border-white/20 shadow-sm overflow-hidden transition-transform duration-300 hover:scale-110`}
      >
        <img
          src={activeSrc}
          alt={`${leagueId} logo`}
          data-logo-source={stage === 0 ? 'football-logos.cc' : 'football-logos-mirror'}
          loading="eager"
          onError={() => {
            if (stage === 0 && mirrorLogoUrl && activeSrc !== mirrorLogoUrl) {
              setStage(1);
            } else {
              setStage(2);
            }
          }}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center shrink-0 border border-white/15 transition-transform duration-300 hover:scale-110`}
      style={{ backgroundColor: `${badgeColor}28`, color: badgeColor }}
      aria-hidden="true"
    >
      {category === 'national' ? (
        <Globe className={iconDims} />
      ) : (
        <Trophy className={iconDims} />
      )}
    </div>
  );
};

