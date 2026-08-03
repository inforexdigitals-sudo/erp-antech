import { useSessionBootstrap } from './features/auth/hooks';
import { FullScreenLoader } from './layouts/AppShell';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  const bootstrapping = useSessionBootstrap();

  if (bootstrapping) {
    return <FullScreenLoader />;
  }

  return <AppRoutes />;
}
