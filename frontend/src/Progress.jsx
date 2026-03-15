import { useEffect , useState} from "react"

export default function Progress(){
    const [some, setSome] = useState([])
    
    useEffect(()=>{
        async function call(){
            const res = await fetch("https://codetrack-10l2.onrender.com/getallcommits")
            const r = await res.json()
            setSome(r)
        }
        call()
    },[])
    return(<><h1>Progress Page:</h1>
        {some && some.map((someone)=>(
            <h1 key={someone.id}>{someone.commit}</h1>
    ))}</>)
}