export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-dark-border border-t-primary"></div>
        <p className="text-sm text-muted">加载中...</p>
      </div>
    </div>
  );
}
