import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Home, LogOut } from 'lucide-react';

const navLink =
  'flex items-center gap-1 px-4 py-2 border-2 border-transparent rounded-full text-xs font-black uppercase tracking-wider hover:border-ink hover:bg-sun';

const Header = () => {
  const location = useLocation();
  const isInGame = location.pathname.includes('/game');

  return (
    <header className="bg-ice border-b-[3px] border-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex justify-between h-[72px] items-center">
          <Link to="/" className="flex items-center gap-2" aria-label="Super Flawed home">
            <img src="/favicon.svg" alt="" className="h-10 w-10" />
            <span className="display text-2xl -rotate-3 leading-[0.8] tracking-tight">
              Super
              <b className="block text-cobalt font-black">Flawed</b>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {!isInGame && (
              <Link to="/rules" className={navLink}>
                <BookOpen className="h-4 w-4" />
                Rules
              </Link>
            )}
            <Link to="/" className={navLink}>
              {isInGame ? (
                <>
                  <LogOut className="h-4 w-4" />
                  Leave Game
                </>
              ) : (
                <>
                  <Home className="h-4 w-4" />
                  Home
                </>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
