import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-accent text-base font-bold text-white">
            AE
          </div>
          <div>
            <div className="text-[15px] font-semibold">Antech ERP</div>
            <div className="text-[11.5px] text-muted">Antech Engineering Pte Ltd</div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
