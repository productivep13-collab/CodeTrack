import { useState } from "react"
import { useParams } from "react-router-dom";

export default function Projectinfo(){
const [inputappear, setInputappear] = useState(false)
const [userAdd, setuserAdd] = useState("")
const [role, setRole] = useState("")
const {proid} = useParams()
console.log(proid)

  const token = localStorage.getItem('token');

async function addmemeber(){
    const response = await fetch(`https://codetrack-10l2.onrender.com/addmember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                name: userAdd, 
                id: proid,
                role

            })
        });
}
    return(<>
        <h1>Project info</h1>
        <button onClick={()=>setInputappear(!inputappear)}>Add members</button>
        {inputappear && 
        <div>
            <input type="text" value={userAdd} onChange={(e)=>setuserAdd(e.target.value)}/>
            <button onClick={()=>setRole("freelancer")}>freelancer</button>
            <button onClick={()=>setRole("client")}>Client</button>
            <button onClick={addmemeber}>submit</button>
        </div>}
        </>)
}