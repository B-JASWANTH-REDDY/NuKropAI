import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
};

export const MandiCardSkeleton: React.FC = () => {
  return (
    <div
      className="glass-card"
      style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}
      aria-label="Loading verified Mandi prices..."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Skeleton width="160px" height="22px" borderRadius="6px" />
          <Skeleton width="60px" height="18px" borderRadius="4px" />
        </div>
        <Skeleton width="220px" height="14px" borderRadius="4px" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        <Skeleton width="110px" height="26px" borderRadius="6px" />
        <Skeleton width="140px" height="14px" borderRadius="4px" />
      </div>
    </div>
  );
};

export const ScannerResultSkeleton: React.FC = () => {
  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
      aria-label="Evaluating crop foliar pathology with Vision AI..."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Skeleton width="40px" height="40px" borderRadius="10px" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="60%" height="20px" borderRadius="6px" />
          <Skeleton width="40%" height="14px" borderRadius="4px" />
        </div>
      </div>

      <Skeleton width="100%" height="50px" borderRadius="8px" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Skeleton width="100%" height="80px" borderRadius="10px" />
        <Skeleton width="100%" height="80px" borderRadius="10px" />
      </div>
    </div>
  );
};
