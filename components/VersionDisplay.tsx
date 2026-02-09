import React from 'react';
import packageJson from '../package.json';

interface VersionDisplayProps {
  style?: React.CSSProperties;
}

export const VersionDisplay: React.FC<VersionDisplayProps> = ({ style }) => {
  return (
    <div style={{ 
      fontSize: '0.85rem', 
      color: '#94a3b8',
      textAlign: 'center',
      ...style 
    }}>
      v{packageJson.version}
    </div>
  );
};
