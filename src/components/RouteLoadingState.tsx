export default function RouteLoadingState() {
  return (
    <div
      className='pointer-events-none w-full px-4 py-5 sm:px-10 sm:py-7'
      role='status'
      aria-live='polite'
      aria-label='正在加载'
    >
      <div className='mx-auto w-full max-w-7xl'>
        <div className='h-px w-full overflow-hidden bg-white/[0.08]'>
          <div className='h-full w-24 animate-pulse bg-linear-to-r from-transparent via-cyan-300/70 to-transparent' />
        </div>
        <div className='mt-6 flex max-w-xl items-start gap-3'>
          <div
            className='mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border border-white/20 border-t-cyan-300'
            aria-hidden='true'
          />
          <div className='min-w-0 flex-1 space-y-3'>
            <div className='h-3 w-48 rounded-full bg-white/[0.07]' />
            <div className='h-3 w-72 max-w-[70vw] rounded-full bg-white/[0.045]' />
          </div>
        </div>
      </div>
      <span className='sr-only'>正在加载</span>
    </div>
  );
}
