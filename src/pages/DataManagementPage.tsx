import type { ChangeEvent, RefObject } from "react";

type DataManagementPageProps = {
  selectedDate: string;
  monthKey: string;
  importMessage: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onExportCsv: () => void;
  onPickCsv: () => void;
  onCsvFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearCurrentDay: () => void;
  onClearCurrentMonth: () => void;
};

export function DataManagementPage({
  selectedDate,
  monthKey,
  importMessage,
  fileInputRef,
  onExportCsv,
  onPickCsv,
  onCsvFileChange,
  onClearCurrentDay,
  onClearCurrentMonth,
}: DataManagementPageProps) {
  return (
    <main
      className="app-shell app-shell--below-nav data-page-shell"
      data-section="data-management-page"
    >
      <div className="content-rail data-stack">
        <header className="page-intro" data-section="data-hero">
          <p className="eyebrow">Data</p>
          <h1>导入、导出与清理</h1>
          <p className="muted">
            CSV 导入会按日期、类目和序号覆盖对应格子，其他数据保持不变。完整 JSON
            备份与恢复仍在「设置」页。
          </p>
        </header>

        <section className="surface-secondary data-management-card" data-section="data-csv">
          <header className="settings-stack__heading">
            <h2>表格导入与导出</h2>
            <p className="muted">适合与 Excel / Numbers 互传明细，或按月份归档。</p>
          </header>
          {importMessage ? <p className="status">{importMessage}</p> : null}
          <div className="action-row">
            <button type="button" data-action="csv-export" onClick={onExportCsv}>
              导出 CSV
            </button>
            <button
              type="button"
              className="secondary-button"
              data-action="csv-import-pick"
              onClick={onPickCsv}
            >
              导入 CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onCsvFileChange}
            />
          </div>
        </section>

        <section
          className="surface-secondary data-management-card data-management-card--danger"
          data-section="data-clear"
        >
          <header className="settings-stack__heading">
            <h2>清理账本数据</h2>
            <p className="muted">
              当前选中日期 {selectedDate}，当月为 {monthKey}。清空后不可撤销，请先导出备份。
            </p>
          </header>
          <div className="danger-zone">
            <button
              type="button"
              className="danger-button"
              data-action="clear-current-day"
              onClick={onClearCurrentDay}
            >
              清空当日数据
            </button>
            <button
              type="button"
              className="danger-button"
              data-action="clear-current-month"
              onClick={onClearCurrentMonth}
            >
              清空当月数据
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
