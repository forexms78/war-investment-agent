"use client";

interface Entry {
  id: string;
  date: string;
  action: "buy" | "sell" | "hold" | "note";
  price?: number;
  quantity?: number;
  analysis_text?: string;
  signal?: string;
  forward_pe?: number;
  created_at: string;
}

interface Props {
  entries: Entry[];
}

const ACTION_STYLE = {
  buy: "bg-green-500 text-black",
  sell: "bg-red-500 text-black",
  hold: "bg-blue-500 text-black",
  note: "bg-gray-600 text-white",
};

const ACTION_LABEL = { buy: "매수", sell: "매도", hold: "보유", note: "분석노트" };

export default function JournalTimeline({ entries }: Props) {
  if (!entries.length) return (
    <p className="text-gray-600 text-sm text-center py-8">
      일지가 없습니다. 분석 텍스트를 붙여넣어 시작하세요.
    </p>
  );

  return (
    <div className="border-l-2 border-gray-800 pl-4 space-y-4">
      {entries.map((e) => (
        <div key={e.id}>
          <p className="text-gray-500 text-xs">
            {new Date(e.created_at).toLocaleDateString("ko-KR")}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded font-bold ${ACTION_STYLE[e.action]}`}>
              {ACTION_LABEL[e.action]}
            </span>
            {e.price && <span className="text-sm text-gray-200">${e.price.toLocaleString()}</span>}
            {e.quantity && <span className="text-sm text-gray-400">× {e.quantity}주</span>}
            {e.forward_pe && <span className="text-xs text-gray-500">P/E {e.forward_pe}</span>}
          </div>
          {e.analysis_text && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {e.analysis_text.slice(0, 120)}...
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
