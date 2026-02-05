import { useState } from 'react'
import { useInventory } from '../Context/InventoryContext'
import InventoryTable from '../components/InventoryTable'
import Header from '../components/Header'


function Inventory() {
  const {
    inventory,
    error,
    totalInventoryValue,
    increaseQuantity,
    decreaseQuantity
  } = useInventory()
  return ( 
   <div>
      <Header title="Inventory"  />
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

export default Inventory

 