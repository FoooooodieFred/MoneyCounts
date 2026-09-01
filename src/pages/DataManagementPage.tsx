import type { ChangeEvent, RefObject } from "react";
import { Link } from "react-router-dom";

type DataManagementPageProps = {
  selectedDate: string;
  monthKey: string;
  importMessage: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  llmFileInputRef: RefObject<HTMLInputElement | null>;
  llmConfigured: boolean;
  llmImporting: boolean;
  onExportCsv: () => void;
  onPickCsv: () => void;
  onCsvFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickLlmSpreadsheet: () => void;
  onLlmSpreadsheetChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearCurrentDay: () => void;
  onClearCurrentMonth: () => void;
  onClearAllData: () => void;
};

export function DataManagementPage({
  selectedDate,
  monthKey,
  importMessage,
  fileInputRef,
  llmFileInputRef,
  llmConfigured,
  llmImporting,
  onExportCsv,
  onPickCsv,
  onCsvFileChange,
  onPickLlmSpreadsheet,
  onLlmSpreadsheetChange,
  onClearCurrentDay,
  onClearCurrentMonth,
  onClearAllData,
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
            CSV 导入会按日期、类目和序号覆盖对应格子。已配置 LLM
            时，也可上传旧账本表格，由模型映射后写入空格子。完整 JSON 备份与恢复仍在「设置」页。
          </p>
        </header>

        {importMessage ? <p className="status">{importMessage}</p> : null}

        <section className="surface-secondary data-management-card" data-section="data-csv">
          <header className="settings-stack__heading">
            <h2>表格导入与导出</h2>
            <p className="muted">适合与 Excel / Numbers 互传本账本明细，或按月份归档。</p>
          </header>
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

        <section className="surface-secondary data-management-card" data-section="data-llm-import">
          <header className="settings-stack__heading">
            <h2>旧账本表格识别</h2>
            <p className="muted">
              {llmConfigured ? (
                "上传以前导出的 CSV / TSV / TXT。模型会映射到本账本 35 类并写入空格子，完成后询问是否导出 JSON 备份。暂不支持 Excel 二进制 .xlsx。"
              ) : (
                <>
                  需要先在 <Link to="/console">API 看台</Link> 填写并验证 LLM
                  模型，才能识别旧记账表格。
                </>
              )}
            </p>
          </header>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              data-action="llm-spreadsheet-import-pick"
              disabled={!llmConfigured || llmImporting}
              onClick={onPickLlmSpreadsheet}
            >
              {llmImporting ? "正在识别…" : "导入旧表格"}
            </button>
            <input
              ref={llmFileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              hidden
              onChange={onLlmSpreadsheetChange}
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
              当前选中日期 {selectedDate}，当月为 {monthKey}
              。清空后不可撤销，请先导出备份。清空所有数据会删除账本、旅游、设置和接口配置。
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
            <button
              type="button"
              className="danger-button"
              data-action="clear-all-data"
              onClick={onClearAllData}
            >
              清空所有数据
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
