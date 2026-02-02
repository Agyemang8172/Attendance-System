
import inventoryData from "../data/inventoryData"
import { useContext, useState, createContext } from "react"

const InventoryContext   = createContext()

 export function InventoryProvider({ children }) {
    const [inventory,setInventory] = useState(inventoryData)
    const [error,setError] = useState('')


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


      const sellProduct = (id,amount)  => {
      if ( amount <= 0 ) return 
         const product = inventory.find((item) => 
           item.id === id
        )

        if (!product) {
          setError('Product not found')
          return
        }

        if (product.quantity < amount) {
          setError(`Not enough stock for  ${product.name}. Available: ${product.quantity}`)
          return
        }
        setError('')

        setInventory((prevInventory)=>
         prevInventory.map((item)=> 
          item.id === id
          ? {...item, quantity: item.quantity - amount} : item
        ))
    }


    
    const mostValuableProduct = inventory.reduce((max,item) => 
      item.quantity * item.price > max.quantity * max.price ?
     item : max,inventory[0]
    )



    const lowStockCount = inventory.filter((item) => 
     item.quantity < item.minStock
    ).length

     const restocking = (id,amount)  => {
      if (amount <= 0) return
      const product = inventory.find((item)=> 
        id === item.id
      )
       if (!product) {
        setError(`There was no product like this`)
        return
       }

       setError('')

      setInventory((prevInventory)=> 
      prevInventory.map((item)=> item.id === id ? {
        ...item, quantity: item.quantity + amount
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


    return (
        <InventoryContext.Provider   value ={{
            inventory,
            error,
            increaseQuantity,
            decreaseQuantity,
            sellProduct,
            restocking,
            criticalItems,
            lowItems,
            stockhealth,
            totalInventoryValue,
            mostValuableProduct,
            lowStockCount
    }}>
            {children}
        </InventoryContext.Provider>
    )
} 

export  function useInventory()  {
    const context =useContext(InventoryContext)

    if (!context)  {
        throw new Error('UseInventory must be used within inventoryProvider')
    }

    return context
} 