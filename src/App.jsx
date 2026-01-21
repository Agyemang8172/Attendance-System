import { useState } from 'react'
import  inventoryData  from './data/inventoryData'
import InventoryTable from './components/InventoryTable'


function App() {
  const [inventory,setInventory] = useState(inventoryData)
 
  return (
   <div>
      <h1> Supermarket Inventory</h1>
    <InventoryTable  
    inventory = {inventory}
    />
   </div>
  )
}

export default App
