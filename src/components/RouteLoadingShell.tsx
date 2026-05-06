interface RouteLoadingShellProps {
  overlay?: boolean;
}

const posterPlaceholders = Array.from({ length: 14 }, (_, index) => index);
const railPlaceholders = Array.from({ length: 6 }, (_, index) => index);

export default function RouteLoadingShell({
  overlay = false,
}: RouteLoadingShellProps) {
  return (
    <div
      className={
        overlay
          ? 'dao-route-loading fixed inset-0 z-[9998] pointer-events-none overflow-hidden bg-[#050608]/88 text-white backdrop-blur-[1px]'
          : 'dao-route-loading min-h-screen overflow-hidden bg-[#050608] text-white'
      }
      aria-hidden='true'
    >
      <div className='absolute inset-0 dao-route-loading__wash' />
      <div className='absolute inset-x-0 top-0 h-px bg-white/10' />

      <div className='relative z-10 min-h-screen px-4 py-5 md:px-7 md:py-6'>
        <div className='mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col gap-8'>
          <header className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='dao-route-loading__mark h-9 w-9 rounded-full border border-white/18 bg-white/8' />
              <div className='space-y-2'>
                <div className='dao-route-loading__bar h-2.5 w-28 rounded-full' />
                <div className='dao-route-loading__bar h-2 w-16 rounded-full opacity-60' />
              </div>
            </div>
            <div className='hidden items-center gap-2 sm:flex'>
              {railPlaceholders.slice(0, 3).map((item) => (
                <div
                  key={item}
                  className='dao-route-loading__pill h-8 w-20 rounded-full'
                />
              ))}
            </div>
          </header>

          <main className='flex flex-1 flex-col justify-center gap-8'>
            <section className='max-w-3xl space-y-4'>
              <div className='dao-route-loading__headline h-10 w-[min(24rem,72vw)] rounded-md md:h-12' />
              <div className='dao-route-loading__bar h-3 w-[min(34rem,82vw)] rounded-full opacity-70' />
            </section>

            <section className='grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7'>
              {posterPlaceholders.map((item) => (
                <div
                  key={item}
                  className='dao-route-loading__poster'
                  style={{ animationDelay: `${(item % 7) * 80}ms` }}
                >
                  <span />
                </div>
              ))}
            </section>

            <section className='hidden grid-cols-6 gap-3 md:grid'>
              {railPlaceholders.map((item) => (
                <div
                  key={item}
                  className='dao-route-loading__rail h-16 rounded-md'
                  style={{ animationDelay: `${item * 70}ms` }}
                />
              ))}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
