import React from 'react';

interface IconProps {
  className?: string;
}

export const ClockIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

export const LightningIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
      clipRule="evenodd"
    />
  </svg>
);

export const BookmarkIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
  </svg>
);

export const TrendingUpIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
      clipRule="evenodd"
    />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 12h6" />
    <path d="M12 9v6" />
  </svg>
);

export const MinusIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 12h6" />
  </svg>
);

export const WalletIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
      clipRule="evenodd"
    />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
      clipRule="evenodd"
    />
  </svg>
);

export const CurrencyDollarIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
      clipRule="evenodd"
    />
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 10-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
      clipRule="evenodd"
    />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

export const StratumIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v.878A2.996 2.996 0 0110 16a2.996 2.996 0 01-3-2.122V13a2 2 0 00-2-2h-1.092A5.977 5.977 0 014 10c0-.703.087-1.382.252-2.033.148.02.3.033.455.033a1.5 1.5 0 001.5-1.5v-.5a1.5 1.5 0 01-.18-.712z" />
  </svg>
);

export const RefineryIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M3 17V11h2V3h3v8h4V5h3v6h2v6H3z" />
  </svg>
);

export const PickaxeIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <g transform="translate(10 10)">
      <g transform="rotate(-35)">
        <rect x="-0.75" y="-7" width="1.5" height="12" rx="0.75" />
        <path d="M-5.5-8c1.5-1.5 3.8-1.5 5.5-1.5S4-9.5 5.5-8L0-6.5z" />
      </g>
      <g transform="rotate(35)">
        <rect x="-0.75" y="-7" width="1.5" height="12" rx="0.75" />
        <path d="M-5.5-8c1.5-1.5 3.8-1.5 5.5-1.5S4-9.5 5.5-8L0-6.5z" />
      </g>
    </g>
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const XverseLogo: React.FC<IconProps> = ({ className = "h-5 w-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 102 102"
    fill="none"
  >
    <rect width="102" height="102" fill="#181818" />
    <path
      d="M74.6542 73.8883V65.2312C74.6542 64.888 74.5177 64.5606 74.2745 64.3174L37.4397 27.4825C37.1965 27.2392 36.8691 27.1028 36.5258 27.1028H27.869C27.4416 27.1028 27.0938 27.4506 27.0938 27.878V35.9211C27.0938 36.2644 27.2302 36.5917 27.4734 36.835L40.6952 50.0567C40.9975 50.3591 40.9975 50.8501 40.6952 51.1524L27.3211 64.5265C27.1756 64.672 27.0938 64.8698 27.0938 65.0744V73.8883C27.0938 74.3153 27.4416 74.6635 27.869 74.6635H42.3342C42.7616 74.6635 43.1094 74.3153 43.1094 73.8883V68.6958C43.1094 68.4912 43.1912 68.2935 43.3368 68.1479L50.5114 60.9733C50.8138 60.6709 51.3048 60.6709 51.6072 60.9733L64.9198 74.2861C65.1631 74.5293 65.4904 74.6658 65.8337 74.6658H73.8767C74.3042 74.6658 74.6519 74.3176 74.6519 73.8906L74.6542 73.8883Z"
      fill="white"
    />
    <path
      d="M55.358 38.5672H62.6031C63.0328 38.5672 63.3829 38.9173 63.3829 39.3469V46.5921C63.3829 47.2877 64.224 47.6355 64.7151 47.1422L74.6541 37.1873C74.7994 37.0418 74.8816 36.844 74.8816 36.6371V27.9189C74.8816 27.4892 74.5334 27.1391 74.1017 27.1391L65.2538 27.1277C65.047 27.1277 64.8492 27.2096 64.7014 27.3551L54.8056 37.235C54.3145 37.726 54.6623 38.5672 55.3557 38.5672H55.358Z"
      fill="#EE7A30"
    />
  </svg>
);
