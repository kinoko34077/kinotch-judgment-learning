-- P2 first real source-backed owner judgment cases.
-- These are manually authored, externally checked proposals, NOT AI-generated
-- or approved personal rules. Seed-only INSERT OR IGNORE preserves owner data.
-- Scope: bounded statements on official web pages, not whole-rule validation.
-- Evidence read 2026-10-30; original Deep Research 46-source ZIP still unavailable.
INSERT OR IGNORE INTO questions
  (id,domain_id,prompt,choices_json,ai_answer,ai_reason,source_note)
VALUES
(
 'uiux-src-uswds-table','uiux',
 'PC上で800件の同じ構造の在庫データを、複数の属性で比較・並び替える。最初に比較する表示形式は？',
 '["A: 画像カードのみ並べる","B: 列見出しを持つ表を基準にし、必要に応じてソート・小画面用表示を検討する","C: 全件を長文テキストで表示する"]',
 'B',
 'USWDSは同じ構造の多量のデータや属性比較に表を案内する。ただし異なる構造の項目ではカードやリストを比較し、小画面では列数・スクロール・積層表示を再設計する。これは無条件の普遍規則ではない。',
 '事前に作成した根拠付き提案（AI自動生成ではない）。公式ガイドの限定主張 CHECK-USWDS-TABLE / USWDS Table: When to use / When to consider something else / Usability guidance。2026-10-30照合。https://designsystem.digital.gov/components/table/ ; 同じ構造の属性比較を前提とし、別用途・モバイルでは判断反転あり。'
),
(
 'uiux-src-wcag257','uiux',
 'WCAG 2.2 AAを適合目標とするWeb編集画面で、ドラッグによる並び替えを実装する。ドラッグが本質的に不可欠ではなく、ユーザーエージェント管理の機能でもない場合、必要な操作経路は？',
 '["A: ドラッグのみあればよい","B: ドラッグ以外の単一ポインター操作でも同じ機能を実現できるようにする","C: キーボードのショートカットだけ追加すれば、単一ポインターの代替は不要"]',
 'B',
 'WCAG 2.2 の達成基準2.5.7（Level AA）は、ドラッグ操作を使用する機能について、essentialまたは未変更のユーザーエージェント管理を除き、ドラッグ不要の単一ポインター経路を求める。キーボード対応の要件とは独立して評価する。',
 '事前に作成した根拠付き提案（AI自動生成ではない）。W3C WCAG 2.2 Recommendation / Success Criterion 2.5.7 Dragging Movements (AA) / CHECK-WCAG22-257。2026-10-30照合。https://www.w3.org/TR/WCAG22/#dragging-movements ; 規格の適用対象と例外の条件付き説明であり、法的義務・製品全体の適合認定ではない。'
);