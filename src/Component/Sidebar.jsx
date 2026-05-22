import { useLocation, useNavigate } from 'react-router-dom'
import {logout}  from '../utils/auth' 
 import { FaHome } from "react-icons/fa";
  import { FaUser } from "react-icons/fa";
  import { SlCalender } from "react-icons/sl";
  import { FaGear } from "react-icons/fa6";
  import { CiLogout } from "react-icons/ci";
  



  const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <FaHome /> },
  { label: 'Profile', path: '/profile', icon: <FaUser /> },
  { label: 'Schedule', path: '/schedule', icon: <SlCalender /> },
  { label: 'Settings', path: '/settings', icon: <FaGear /> },
]


const Sidebar =   ({isOpen , onClose})  => {

    const navigate = useNavigate()
    const location = useLocation()


    const handleLogOut = ()  => {
        logout()
        navigate('/login')
    }


    return (
       <>
        {
            isOpen && (
            <div
          className="fixed inset-0 bg-black/10 z-20 lg:hidden"
          onClick={onClose}
        />
            )
        }

        <aside className={`fixed  top-0 left-0 h-screen w-64 bg-[#0f172a] 
            flex flex-col justify-between py-8 px-6 z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0'  : '-translate-x-full'} 
              lg:translate-x-0
            `}>
        <div className="mb-10">
          <h2 className="text-white text-2xl font-bold tracking-wide ">AttendPro</h2>
          <p className='text-blue-400 text-xs mt-1'>
            Attendance Management
          </p>
        </div>
        
        
        <nav className='flex flex-col gap-2'>
            {
                navItems.map((item)=> {
                     const isActive = location.pathname === item.path
                     return(
                        <div
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    onClose() // Close sidebar on mobile after clicking
                  }}
                  className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-lg 
                    text-sm font-medium cursor-pointer transition
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                     )
                })
            }

        </nav>

        <div  className='flex flex-col gap-4'>
             <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-500 text-xs">Systems Online v1.0</span>

        </div>
        
        <button 
         onClick={handleLogOut} 
         className=" flex items-center gap-3 w-full text-gray-400
                      hover:text-white hover:bg-red-600 border
                       border-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium transition">
         <CiLogout className="text-base" />
            <span>Logout</span>
        </button>
      </aside>

      </>

    )

}  

export default Sidebar