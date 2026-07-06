// Shown in the content area (sidebar stays) while a page's data loads.
export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-7 w-48 bg-line rounded-lg" />
      <div className="h-3.5 w-72 bg-bg2 rounded mt-3" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 mt-7 max-w-[1240px]">
        <div className="flex flex-col gap-5">
          <div className="h-28 bg-card border border-line rounded-2xl" />
          <div className="h-16 bg-card border border-line rounded-2xl" />
          <div className="h-64 bg-card border border-line rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-card border border-line rounded-2xl" />
            <div className="h-24 bg-card border border-line rounded-2xl" />
          </div>
          <div className="h-48 bg-card border border-line rounded-2xl" />
          <div className="h-32 bg-card border border-line rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
