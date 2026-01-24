import { useState } from 'react'
import  inventoryData  from './data/inventoryData'
import InventoryTable from './components/InventoryTable'


function App() {
  const [inventory,setInventory] = useState(inventoryData)

  const  increaseQuantity = (id)  => {
    setInventory((prevInventory)=> 
      prevInventory.map((item)=> item.id === id ?
      {...item, quantity:item.quantity + 1} : item
  ))}

  const decreaseQuantity = (id)  => {
     setInventory((prevInventory) => 
      prevInventory.map((item)=> item.id === id ? 
     {...item, quantity: item.quantity > 0 ? item.quantity-1:0
     } : item
    ))
  }

    //Detect critical items
  const criticalItems = inventory.filter((item) =>
    item.quantity <= item.minStock / 2)

  //Detct low Items
  const lowItems = inventory.filter((item)=>
    item.quantity < item.minStock && 
     item.quantity > item.minStock/2
  )

  //Stock health 
  const stockhealth = 
          criticalItems.length > 0
           ? 'Critical'
           : lowItems.length > 0
           ? 'Warning'
           :  'Healthy'

  const totalInventoryValue = inventory.reduce((total, item ) => 
    total + item.quantity * item.price,0
  )

    const sellProduct = (id,amount)  => {
      if ( amount <= 0 ) return 

         setInventory((prevInventory) => 
         prevInventory.map((item) => {
           item.id === id ?
           item.quantity >= amount ? {
            ...item,quantity: item.quantity - amount
           } : item: item
         })
      )
    }


    const mostValuableProduct = inventory.reduce((max,item) => 
      item.quantity * item.price > max.quantity * max.price ?
     item : max,inventory[0]
    )



    const lowStockCount = inventory.filter((item) => 
     item.quantity < item.minStock
    ).length
 
  return (
   <div>
      <h1> Supermarket Inventory</h1> 
         <h2> Total Inventory Value :{totalInventoryValue}</h2>
    <InventoryTable  
       inventory = {inventory}
       increaseQuantity = {increaseQuantity}
       decreaseQuantity = {decreaseQuantity}
    />
   </div>
  )
}

export default App
