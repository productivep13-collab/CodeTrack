import { useEffect , useState} from "react"

export default function Progress(){
    const [some, setSome] = useState([])
    
    useEffect(()=>{
        async function call(){
            const res = await fetch("http://127.0.0.1:8000/getallcommits")
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