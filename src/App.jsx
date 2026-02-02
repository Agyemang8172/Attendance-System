import { useState } from 'react'
import { useInventory } from './Context/InventoryContext'
import InventoryTable from './components/InventoryTable'


function App() {
  const {
    inventory,
    error,
    totalInventoryValue,
    increaseQuantity,
    decreaseQuantity
  } = useInventory()
  return ( 
   <div>
      <h1> Supermarket Inventory</h1>  
         <h2> Total Inventory Value :{totalInventoryValue}</h2>
         {error && <p style={{ color: 'red'}}> {error}</p>}
    <InventoryTable  
     
       inventory ={inventory}
       increaseQuantity ={increaseQuantity}
       decreaseQuantity ={decreaseQuantity}
    />
   </div> 
  )
}

export default App
 