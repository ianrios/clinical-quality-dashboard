interface Props {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = 'w-16', height = 'h-4', className = '' }: Props) {
  return <div className={`bg-gray-200 rounded animate-pulse ${width} ${height} ${className}`} />;
}
