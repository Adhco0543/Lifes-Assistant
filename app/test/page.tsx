"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../public/src/lib/firebase"; // adjust the path

export default function TestPage() {
    const addTestDoc = async () => {
        try {
            await addDoc(collection(db, "test"), {
                message: "Firestore is working", 
                createdAt: serverTimestamp(),
            });
            alert("Test document added");
        } catch (error) {
            console.log("document added");
            alert("Error adding document");
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>Firestore Test</h1>
            <button onClick={addTestDoc}>Add Test Document</button>
            </div>
    );
}