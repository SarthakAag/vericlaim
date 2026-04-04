import React from "react";

const getColor = (score: number) => {
  if (score < 30) return "bg-green-500";
  if (score < 60) return "bg-yellow-500";
  return "bg-red-500";
};

const getLabel = (score: number) => {
  if (score < 30) return "Low Risk";
  if (score < 60) return "Medium Risk";
  return "High Risk";
};

const FraudScoreMeter: React.FC<{ score: number }> = ({ score }) => {
  return (
    <div className="w-full max-w-md p-4 bg-white rounded-2xl shadow-md">

      <h2 className="text-lg font-semibold mb-2">Fraud Score</h2>

      {/* Bar */}
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`${getColor(score)} h-4`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Label */}
      <div className="flex justify-between mt-2 text-sm">
        <span>{score}/100</span>
        <span className="font-medium">{getLabel(score)}</span>
      </div>

    </div>
  );
};

export default FraudScoreMeter;