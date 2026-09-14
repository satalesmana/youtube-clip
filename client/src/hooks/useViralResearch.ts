import { useCallback, useState } from 'react';
import { api } from '../services/api';
import type { TrendTopic } from '../types';

export function useViralResearch() {
  const [keyword, setKeyword] = useState('');
  const [subreddits, setSubreddits] = useState('worldnews, indonesia, technology');
  const [maxTrends, setMaxTrends] = useState(10);
  const [language, setLanguage] = useState('id');
  const [providers, setProviders] = useState<string[]>(['rss', 'reddit', 'trends', 'x']);

  const [topics, setTopics] = useState<TrendTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleProvider = useCallback((id: string) => {
    setProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const applyPreset = useCallback((presetKeyword: string, presetSubs?: string) => {
    setKeyword(presetKeyword);
    if (presetSubs) setSubreddits(presetSubs);
  }, []);

  const runResearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const subList = subreddits
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const result = await api.runResearch({
        keyword: keyword.trim() || undefined,
        subreddits: subList.length > 0 ? subList : undefined,
        providers,
        maxTrends,
        language,
      });

      setTopics(result.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal melakukan riset tren.');
    } finally {
      setLoading(false);
    }
  }, [keyword, subreddits, providers, maxTrends, language]);

  return {
    keyword,
    setKeyword,
    subreddits,
    setSubreddits,
    maxTrends,
    setMaxTrends,
    language,
    setLanguage,
    providers,
    toggleProvider,
    applyPreset,
    topics,
    loading,
    error,
    runResearch,
  };
}
