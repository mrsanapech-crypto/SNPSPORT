import React from 'react';
import { Newspaper, RefreshCw, ExternalLink, Globe } from 'lucide-react';
import { FootballNewsItem } from '../utils/footballLogic';

interface LatestNewsSectionProps {
  leagueName: string;
  leagueNameKh?: string;
  articles: FootballNewsItem[];
  sources: { title: string; uri: string }[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const LatestNewsSection: React.FC<LatestNewsSectionProps> = ({
  leagueName,
  articles,
  sources,
  isLoading,
  onRefresh,
}) => {
  return (
    <section
      aria-label="Latest Football News"
      className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#fbbf24]" />
            <h2 className="text-sm font-display font-bold tracking-wider text-[#f8fafc]">
              ព័ត៌មានបាល់ទាត់ថ្មីៗ និងផ្លូវការ
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#cbd5e1] mt-0.5">
            <span>ប្រភពផ្លូវការ</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#fbbf24] font-semibold">
              {leagueName || 'លីគកំពូលអឺរ៉ុបទាំង 5 និង UEFA Champions League'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh latest news"
          className="min-h-[38px] px-3.5 py-1.5 rounded-full liquid-glass-subtle text-xs font-semibold text-[#f8fafc] hover:border-[#fbbf24] hover:text-[#fbbf24] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isLoading ? 'animate-spin text-[#fbbf24]' : 'text-[#fbbf24]'
            }`}
          />
          <span>{isLoading ? 'កំពុងទាញយក...' : 'ផ្ទុកព័ត៌មានថ្មី'}</span>
        </button>
      </div>

      {/* Loading Skeleton or News Articles List */}
      {isLoading && articles.length === 0 ? (
        <div className="space-y-3" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl liquid-glass-subtle animate-pulse space-y-2"
            >
              <div className="h-3 w-36 bg-white/10 rounded" />
              <div className="h-4 w-3/4 bg-white/15 rounded" />
              <div className="h-3 w-full bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="p-6 text-center rounded-2xl liquid-glass-subtle">
          <p className="text-xs text-[#cbd5e1]">មិនទាន់មានព័ត៌មានបាល់ទាត់ថ្មីៗនៅពេលនេះទេ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article, idx) => (
            <article
              key={article.id}
              style={{ animationDelay: `${Math.min(idx * 65, 320)}ms` }}
              className="p-4 rounded-2xl liquid-glass-subtle liquid-glass-interactive animate-liquid-spring space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#94a3b8]">
                <span className="font-semibold text-[#f59e0b]">
                  {article.leagueName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num tabular-nums">
                  {article.publishedAgo}
                </span>
                <span aria-hidden="true">·</span>
                <span>{article.sourceTitle}</span>
              </div>

              <h3 className="text-sm font-bold text-[#f8fafc] leading-snug">
                <a
                  href={article.sourceUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#f59e0b] transition-colors inline-flex items-start gap-1.5"
                >
                  <span>{article.headline}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#f59e0b]" />
                </a>
              </h3>

              {article.summary && (
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  {article.summary}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Grounding Sources Footer */}
      {sources.length > 0 && (
        <div className="pt-3 border-t border-[#273248] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8]">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>ប្រភពផ្លូវការ៖</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sources.slice(0, 3).map((src, idx) => (
              <a
                key={idx}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f8fafc] hover:text-[#f59e0b] underline flex items-center gap-1 truncate max-w-[200px]"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
