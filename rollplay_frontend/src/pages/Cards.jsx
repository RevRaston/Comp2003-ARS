import { useEffect, useState } from "react";

export default function Cards({ token }) {
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState({
    card_holder: "",
    card_number: "",
    expiry_month: "",
    expiry_year: "",
    cvv: ""
  });

  async function loadCards() {
    const res = await fetch("http://localhost:3000/cards", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setCards(data.cards || []);
  }

  async function addCard(e) {
    e.preventDefault();

    await fetch("http://localhost:3000/cards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    loadCards();
  }

  async function deleteCard(id) {
    await fetch(`http://localhost:3000/cards/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    loadCards();
  }

  useEffect(() => { loadCards(); }, []);

  return (
    <div>
      <h2>Your Cards</h2>

      {cards.map((c) => (
        <div key={c.id}>
          <strong>{c.card_holder}</strong> — **** **** **** {c.card_number.slice(-4)}
          <button onClick={() => deleteCard(c.id)}>Delete</button>
        </div>
      ))}

      <h3>Add Card</h3>
      <form onSubmit={addCard}>
        <input placeholder="Name" onChange={(e) => setForm({ ...form, card_holder: e.target.value })} />
        <input placeholder="Number" onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
        <input placeholder="MM" onChange={(e) => setForm({ ...form, expiry_month: e.target.value })} />
        <input placeholder="YY" onChange={(e) => setForm({ ...form, expiry_year: e.target.value })} />
        <input placeholder="CVV" onChange={(e) => setForm({ ...form, cvv: e.target.value })} />
        <button type="submit">Add Card</button>
      </form>
    </div>
  );
}
