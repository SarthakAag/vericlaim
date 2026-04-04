import React from "react";

interface FraudData {
  fraud_score: number;
  fraud_risk: "low" | "medium" | "high";
  flags: string[];
}

const getColor = (risk: string) => {
  if (risk === "low") return "bg-green-100 text-green-700";
  if (risk === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
};

const getIcon = (risk: string) => {
  if (risk === "low") return "✅";
  if (risk === "medium") return "⚠";
  return "🚨";
};

const formatFlag = (flag: string) => {
  return flag
    .replace("FRAUD_", "")
    .replaceAll("_", " ")
    .toLowerCase();
};

const FraudStatusCard: React.FC<{ fraud: FraudData }> = ({ fraud }) => {
  return (
    <div className="p-4 rounded-2xl shadow-md bg-white w-full max-w-md">
      
      {/* Header */}
      <div className={`p-3 rounded-lg mb-3 ${getColor(fraud.fraud_risk)}`}>
        <h2 className="text-lg font-semibold">
          {getIcon(fraud.fraud_risk)} Fraud Status: {fraud.fraud_risk.toUpperCase()}
        </h2>
        <p className="text-sm">Score: {fraud.fraud_score}/100</p>
      </div>

      {/* Flags */}
      <div>
        <h3 className="font-medium mb-2">Details:</h3>
        {fraud.flags.length === 0 ? (
          <p className="text-sm text-gray-500">No issues detected</p>
        ) : (
          <ul className="list-disc ml-5 text-sm">
            {fraud.flags.map((flag, index) => (
              <li key={index}>{formatFlag(flag)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FraudStatusCard;