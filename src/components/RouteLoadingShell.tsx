interface RouteLoadingShellProps {
  overlay?: boolean;
}

const cardPlaceholders = Array.from({ length: 12 }, (_, index) => index);
const filterPlaceholders = Array.from({ length: 8 }, (_, index) => index);

export default function RouteLoadingShell({
  overlay = false,
}: RouteLoadingShellProps) {
  return (
    <div
      className={
        overlay
          ? 'fixed inset-0 z-[9998] pointer-events-none bg-black/88 backdrop-blur-[2px]'
          : 'min-h-screen bg-black'
      }
      aria-hidden='true'
    >
      <div className='min-h-screen w-full animate-pulse'>
        <div className='hidden md:block fixed left-0 top-0 h-full w-20 border-r border-white/10 bg-zinc-950/95' />
        <div className='hidden md:block fixed inset-x-0 top-0 h-20 border-b border-white/8 bg-black/70 backdrop-blur-xl'>
          <div className='ml-24 flex h-full items-center justify-center'>
            <div className='h-11 w-[min(42rem,44vw)] rounded-full bg-white/10' />
          </div>
          <div className='absolute right-6 top-4 flex gap-2'>
            <div className='h-10 w-10 rounded-full bg-white/10' />
            <div className='h-10 w-10 rounded-full bg-white/10' />
          </div>
        </div>

        <main className='px-4 pt-20 pb-24 md:pl-28 md:pr-8 md:pt-28'>
          <div className='mb-7 max-w-6xl'>
            <div className='mb-3 h-8 w-44 rounded-lg bg-white/12' />
            <div className='h-4 w-72 max-w-full rounded bg-white/8' />
          </div>

          <div className='mb-7 flex flex-wrap gap-3'>
            {filterPlaceholders.map((item) => (
              <div
                key={item}
                className='h-10 w-24 rounded-xl border border-white/8 bg-white/8'
              />
            ))}
          </div>

          <div className='grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8'>
            {cardPlaceholders.map((item) => (
              <div key={item} className='space-y-2'>
                <div className='aspect-[2/3] rounded-lg bg-white/10 shadow-lg shadow-black/20' />
                <div className='h-3.5 rounded bg-white/9' />
                <div className='h-3 w-2/3 rounded bg-white/6' />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
