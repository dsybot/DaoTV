import { CinematicLoadingFallback } from '@/components/CinematicLoadingFallback';

export default function Loading() {
  return (
    <div className='fixed inset-0 z-50'>
      <CinematicLoadingFallback />
    </div>
  );
}
