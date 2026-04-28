"use client";
import { useState } from "react";

interface Props {
  term: string;
  children: React.ReactNode;
}

const DEFINITIONS: Record<string, { title: string; body: string }> = {
  "Forward P/E": {
    title: "Forward P/E (선행 주가수익비율)",
    body: "현재 주가 ÷ 향후 12개월 예상 EPS. 높을수록 미래 성장 기대가 주가에 많이 반영된 것. 업종 평균과 비교 필수.",
  },
  EPS: {
    title: "EPS (주당순이익)",
    body: "1주당 회사가 벌어들인 순이익. Forward EPS는 애널리스트 컨센서스 기반 미래 예상치.",
  },
  오버행: {
    title: "오버행 (Overhang)",
    body: "전환사채·스톡옵션 등이 주식으로 전환되면 유통 주식 수가 늘어 1주당 가치가 희석됨. 매도 압력 요인.",
  },
  "Graham Number": {
    title: "Graham Number (그레이엄 수치)",
    body: "√(22.5 × EPS × BPS). 벤저민 그레이엄의 보수적 적정가. 현재가가 Graham Number보다 낮으면 저평가 신호.",
  },
  PEG: {
    title: "PEG (주가이익성장비율)",
    body: "P/E ÷ EPS 성장률. 1 이하면 성장 대비 저평가. 고성장주 평가에 유리한 지표.",
  },
  PBR: {
    title: "PBR (주가순자산비율)",
    body: "현재가 ÷ BPS(주당순자산). 1 미만이면 청산가치보다 싸게 거래 중. 자산 중심 기업 평가에 적합.",
  },
  ROE: {
    title: "ROE (자기자본이익률)",
    body: "순이익 ÷ 자기자본. 회사가 주주 돈을 얼마나 효율적으로 운용하는지 측정. 15% 이상이면 우량.",
  },
  부채비율: {
    title: "부채비율",
    body: "총부채 ÷ 자기자본. 낮을수록 재무 안정성 높음. 200% 초과 시 비체계적 위험 요인.",
  },
  BPS: {
    title: "BPS (주당순자산)",
    body: "1주당 순자산 가치. Graham Number 계산의 핵심 변수. 높을수록 자산 기반이 탄탄한 기업.",
  },
};

export default function QuantTooltip({ term, children }: Props) {
  const [show, setShow] = useState(false);
  const def = DEFINITIONS[term];

  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      {def && (
        <button
          className="w-4 h-4 rounded-full bg-gray-700 text-gray-400 text-[10px] font-bold flex items-center justify-center hover:bg-gray-600 flex-shrink-0"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onClick={() => setShow(!show)}
        >
          ?
        </button>
      )}
      {show && def && (
        <div className="absolute bottom-6 left-0 z-50 w-64 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 shadow-xl">
          <p className="font-bold text-blue-400 mb-1">{def.title}</p>
          <p className="leading-relaxed">{def.body}</p>
        </div>
      )}
    </span>
  );
}
