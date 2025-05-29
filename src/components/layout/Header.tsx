import { Link, useLocation } from 'react-router-dom';
import { PanelLeft, Home, LogOut } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const isInGame = location.pathname.includes('/game');
  
  return (
    <header className="bg-gray-800 border-b border-gray-700 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <PanelLeft className="h-8 w-8 text-indigo-400" />
            <span className="ml-2 text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
              Super Flawed
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {isInGame ? (
              <>
                <Link 
                  to="/" 
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Leave Game
                </Link>
              </>
            ) : (
              <Link 
                to="/" 
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"
              >
                <Home className="h-4 w-4 mr-1" />
                Home
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;