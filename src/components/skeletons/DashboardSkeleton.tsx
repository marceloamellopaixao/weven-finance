import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  // Alturas fixas para evitar chamadas impuras de Math.random() durante a renderização
  const barHeights = [45, 72, 35, 88, 55, 62, 48, 92, 68, 42, 78, 58];

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
           <div className="h-11 w-full md:w-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
           <div className="h-11 w-full md:w-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="relative overflow-hidden border-none shadow-sm bg-white dark:bg-zinc-900 rounded-2xl h-36">
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
             </CardHeader>
             <CardContent className="space-y-3">
                <div className="h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
             </CardContent>
          </Card>
        ))}
      </div>

      <div className="w-full space-y-8">
         {/* Chart Skeleton */}
         <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-2xl">
            <CardHeader className="pb-6 space-y-3">
               <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
               <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
            </CardHeader>
            <CardContent className="h-[280px] w-full px-6 pb-6">
               <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse flex items-end justify-between px-4 pb-4 gap-2">
                  {barHeights.map((h, i) => (
                    <div key={i} className="w-full bg-zinc-200 dark:bg-zinc-700/50 rounded-t-sm" style={{ height: `${h}%` }} />
                  ))}
               </div>
            </CardContent>
         </Card>

         {/* Table Skeleton */}
         <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <div className="border-b border-zinc-100 dark:border-zinc-800 py-5 px-6 flex flex-col md:flex-row justify-between gap-4">
               <div className="space-y-2">
                  <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
               </div>
               <div className="flex gap-2">
                 <div className="h-9 w-full md:w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                 <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
               </div>
            </div>
            <div className="p-0">
               {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex justify-between items-center p-4 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                     <div className="space-y-2">
                        <div className="h-4 w-32 md:w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                        <div className="h-3 w-16 md:w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                     </div>
                     <div className="flex gap-4">
                        <div className="hidden md:block h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                        <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                     </div>
                  </div>
               ))}
            </div>
         </Card>
      </div>
    </div>
  );
}