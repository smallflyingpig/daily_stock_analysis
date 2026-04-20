import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Play, Square, X, RefreshCw } from 'lucide-react';
import { ApiErrorAlert, Button, Card, EmptyState, InlineAlert } from '../components/common';
import { StockAutocomplete } from '../components/StockAutocomplete/StockAutocomplete';
import { systemConfigApi } from '../api/systemConfig';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { cn } from '../utils/cn';

const TIME_OPTIONS = [
  { label: '09:00 (开盘前)', value: '09:00' },
  { label: '11:30 (午盘结束)', value: '11:30' },
  { label: '15:00 (收盘)', value: '15:00' },
  { label: '18:00 (傍晚)', value: '18:00' },
  { label: '20:00 (晚间)', value: '20:00' },
  { label: '21:00 (夜盘)', value: '21:00' },
];

const SchedulePage: React.FC = () => {
  useEffect(() => {
    document.title = '定时推送 - DSA';
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Config state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [stockList, setStockList] = useState<string[]>([]);
  const [configVersion, setConfigVersion] = useState<string>('');
  const [maskToken, setMaskToken] = useState<string>('');

  // Input state for adding new stock
  const [stockInput, setStockInput] = useState('');

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await systemConfigApi.getConfig();
      setConfigVersion(response.configVersion);
      setMaskToken(response.maskToken);

      // Extract schedule-related config
      const items = response.items;
      for (const item of items) {
        if (item.key === 'SCHEDULE_ENABLED') {
          setScheduleEnabled(item.value === 'true');
        } else if (item.key === 'SCHEDULE_TIME') {
          setScheduleTime(item.value || '18:00');
        } else if (item.key === 'STOCK_LIST') {
          const stocks = (item.value || '').split(',').filter((s: string) => s.trim());
          setStockList(stocks);
        }
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (successMessage) {
      const timer = window.setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const saveConfig = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await systemConfigApi.update({
        configVersion,
        maskToken,
        items: [
          { key: 'SCHEDULE_ENABLED', value: scheduleEnabled ? 'true' : 'false' },
          { key: 'SCHEDULE_TIME', value: scheduleTime },
          { key: 'STOCK_LIST', value: stockList.join(',') },
        ],
      });
      setSuccessMessage('定时推送配置已保存');
      // Reload to get new config version
      await loadConfig();
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setIsSaving(false);
    }
  }, [configVersion, maskToken, scheduleEnabled, scheduleTime, stockList, loadConfig]);

  const addStock = useCallback((code: string, name?: string) => {
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode) return;
    if (stockList.includes(normalizedCode)) {
      setSuccessMessage(`${normalizedCode} 已在列表中`);
      return;
    }
    setStockList((prev) => [...prev, normalizedCode]);
    setStockInput('');
    setSuccessMessage(`已添加 ${normalizedCode}${name ? ` (${name})` : ''}`);
  }, [stockList]);

  const removeStock = useCallback((code: string) => {
    setStockList((prev) => prev.filter((s) => s !== code));
  }, []);

  const handleStockSubmit = useCallback((code: string, name?: string) => {
    addStock(code, name);
  }, [addStock]);

  const formatStockCode = (code: string): string => {
    // Format display: add market prefix hint
    if (code.match(/^\d{6}$/)) {
      return `${code} (A股)`;
    }
    if (code.match(/^\d{5}$/) || code.startsWith('HK')) {
      return `${code} (港股)`;
    }
    if (code.match(/^[A-Z]{1,5}$/)) {
      return `${code} (美股)`;
    }
    return code;
  };

  const sortedStockList = useMemo(() => {
    return [...stockList].sort((a, b) => a.localeCompare(b));
  }, [stockList]);

  if (isLoading) {
    return (
      <div className="schedule-page min-h-screen p-4 md:p-6">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan/20 border-t-cyan" />
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-page min-h-screen space-y-4 p-4 md:p-6">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-soft-card">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">定时推送</h1>
            <p className="text-xs md:text-sm text-secondary">
              设置每日固定时间自动推送股票分析报告
            </p>
          </div>
        </div>
      </section>

      {error ? <ApiErrorAlert error={error} onDismiss={() => setError(null)} /> : null}
      {successMessage ? (
        <InlineAlert variant="success" title="操作成功" message={successMessage} />
      ) : null}

      {/* Schedule Status Card */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {scheduleEnabled ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20 text-success">
                <Play className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                <Square className="h-4 w-4" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {scheduleEnabled ? '定时推送已启用' : '定时推送已暂停'}
              </p>
              <p className="text-xs text-secondary">
                {scheduleEnabled
                  ? `每天 ${scheduleTime} 自动推送 ${stockList.length} 只股票的分析报告`
                  : '启用后将在每天固定时间推送分析报告'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setScheduleEnabled(!scheduleEnabled)}
            className={cn(
              'btn-secondary text-sm px-4 py-2',
              scheduleEnabled ? 'text-warning' : ''
            )}
          >
            {scheduleEnabled ? '暂停推送' : '启用推送'}
          </button>
        </div>
      </Card>

      {/* Time Setting Card */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">推送时间</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="input-surface input-focus-glow h-11 w-full rounded-xl border bg-transparent px-4 text-sm transition-all focus:outline-none"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-secondary">
            建议选择收盘后时间（如 18:00），确保当天数据完整
          </p>
        </div>
      </Card>

      {/* Stock List Card */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          分析股票列表
          <span className="ml-2 text-xs text-secondary">
            ({stockList.length} 只)
          </span>
        </h3>

        {/* Add Stock Input */}
        <div className="mb-3">
          <StockAutocomplete
            value={stockInput}
            onChange={setStockInput}
            onSubmit={handleStockSubmit}
            placeholder="输入股票代码添加到推送列表"
          />
        </div>

        {/* Stock List */}
        {stockList.length === 0 ? (
          <EmptyState
            title="暂无股票"
            description="添加股票后，定时推送将自动分析这些股票"
            className="border-none bg-transparent py-6 shadow-none"
          />
        ) : (
          <div className="max-h-64 overflow-auto rounded-lg border border-white/10 p-2">
            <div className="space-y-1">
              {sortedStockList.map((code) => (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                >
                  <span className="font-mono text-foreground">{formatStockCode(code)}</span>
                  <button
                    type="button"
                    onClick={() => removeStock(code)}
                    className="text-secondary hover:text-danger"
                    aria-label={`删除 ${code}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-secondary">
          支持A股(6位数字)、港股(5位数字或HK前缀)、美股(字母代码)
        </p>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={() => void saveConfig()}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              保存中...
            </>
          ) : (
            '保存配置'
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void loadConfig()}
          disabled={isLoading || isSaving}
        >
          重置
        </Button>
      </div>

      {/* Tips Card */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-2">使用说明</h3>
        <ul className="text-xs text-secondary space-y-1">
          <li>• 定时推送依赖系统后台服务运行，请确保服务已启动</li>
          <li>• 推送渠道在「设置」页面的「通知」分类中配置</li>
          <li>• 如需立即测试，可在首页手动分析单只股票</li>
          <li>• 股票列表支持随时修改，下次推送时生效</li>
        </ul>
      </Card>
    </div>
  );
};

export default SchedulePage;