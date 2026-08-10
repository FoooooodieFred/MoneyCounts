import { useMemo, useState } from "react";
import { Button, Card, Input, Label, ListBox, Select, TextField } from "@heroui/react";

export type SearchableLedgerRecord = {
  date: string;
  category: string;
  amount: number;
  currency: string;
  note: string;
  convertedAmount: number;
};

type SearchPageProps = {
  records: SearchableLedgerRecord[];
  categories: string[];
  currency: string;
  formatMoney: (value: number, currency: string) => string;
  onSelectDate: (date: string) => void;
};

export function SearchPage({
  records,
  categories,
  currency,
  formatMoney,
  onSelectDate,
}: SearchPageProps) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const filteredRecords = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;

    return records.filter((record) => {
      const amount = Math.abs(record.convertedAmount);
      const matchesText =
        !text ||
        record.note.toLowerCase().includes(text) ||
        record.category.toLowerCase().includes(text) ||
        String(Math.abs(record.amount)).includes(text);
      const matchesCategory = category === "全部" || record.category === category;
      const matchesStart = !startDate || record.date >= startDate;
      const matchesEnd = !endDate || record.date <= endDate;
      const matchesMin = min === null || (Number.isFinite(min) && amount >= min);
      const matchesMax = max === null || (Number.isFinite(max) && amount <= max);
      return (
        matchesText && matchesCategory && matchesStart && matchesEnd && matchesMin && matchesMax
      );
    });
  }, [category, endDate, keyword, maxAmount, minAmount, records, startDate]);

  const total = filteredRecords.reduce((sum, record) => sum + record.convertedAmount, 0);

  return (
    <main className="app-shell app-shell--below-nav search-page-shell" data-section="search-page">
      <section className="search-hero" data-section="search-hero">
        <p className="eyebrow">Search</p>
        <h1>搜索与高级筛选</h1>
        <p className="muted">
          按备注、分类、金额和日期组合筛选。当前账本暂无标签字段，可用备注关键词作为标签搜索，例如输入「咖啡」或「#通勤」。
        </p>
      </section>

      <Card className="search-filter-card" data-section="search-filters">
        <Card.Content>
          <div className="search-filter-grid">
            <TextField value={keyword} onChange={setKeyword}>
              <Label>关键词</Label>
              <Input data-action="search-keyword" placeholder="备注 / 分类 / 金额" />
            </TextField>
            <Select
              data-action="search-category"
              value={category}
              onChange={(key) => setCategory(String(key ?? "全部"))}
            >
              <Label>分类</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="全部" textValue="全部分类">
                    全部分类
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {categories.map((item) => (
                    <ListBox.Item key={item} id={item} textValue={item}>
                      {item}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <TextField type="date" value={startDate} onChange={setStartDate}>
              <Label>开始日期</Label>
              <Input data-action="search-start-date" />
            </TextField>
            <TextField type="date" value={endDate} onChange={setEndDate}>
              <Label>结束日期</Label>
              <Input data-action="search-end-date" />
            </TextField>
            <TextField value={minAmount} onChange={setMinAmount}>
              <Label>最小金额（{currency}）</Label>
              <Input data-action="search-min-amount" inputMode="decimal" placeholder="0" />
            </TextField>
            <TextField value={maxAmount} onChange={setMaxAmount}>
              <Label>最大金额（{currency}）</Label>
              <Input data-action="search-max-amount" inputMode="decimal" placeholder="不限" />
            </TextField>
          </div>
          <div className="search-filter-summary">
            <span>命中 {filteredRecords.length} 条</span>
            <strong>合计 {formatMoney(total, currency)}</strong>
          </div>
        </Card.Content>
      </Card>

      <section className="search-result-list" data-section="search-results">
        {filteredRecords.length ? (
          filteredRecords.map((record, index) => (
            <Card key={`${record.date}-${record.category}-${index}`} className="search-result-item">
              <Card.Content>
                <div>
                  <span>{record.date}</span>
                  <strong>{record.category}</strong>
                  <small>{record.note || "无备注"}</small>
                </div>
                <div>
                  <strong>{formatMoney(record.amount, record.currency)}</strong>
                  <small>
                    {record.currency === currency
                      ? "当前口径"
                      : `≈ ${formatMoney(record.convertedAmount, currency)}`}
                  </small>
                </div>
                <Button
                  variant="secondary"
                  data-action="search-select-date"
                  onPress={() => onSelectDate(record.date)}
                >
                  定位日期
                </Button>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card className="search-result-empty">
            <Card.Header>
              <Card.Title>没有找到匹配记录</Card.Title>
              <Card.Description>
                试着放宽日期、金额区间，或用备注里的关键词继续搜索。
              </Card.Description>
            </Card.Header>
          </Card>
        )}
      </section>
    </main>
  );
}
