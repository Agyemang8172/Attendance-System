import { useState } from 'react';
import Sidebar from './Sidebar'
import { CiMenuBurger } from "react-icons/ci";



const Layout = ({children})  => {
     const [sidebarOpen, setSidebarOpen] = useState(false)


    return(
        
            <div  className=' min-h-screen bg-gray-100'>
                <Sidebar
                  isOpen= {sidebarOpen}
                  onClose={() => setSidebarOpen(false)}
                />

                <div className='lg:hidden bg-[#0f172a] px-4 py-3 flex items-center gap-4'>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-white text-xl">
                        <CiMenuBurger />
                    </button>
                </div>



                 <main className="p-6 lg:p-8 lg:ml-64">
                   {children}
                </main>
            </div>

    )
}

export default Layout