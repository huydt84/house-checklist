import { useState } from "react";
import { createRoot } from "react-dom/client";
import AnswerControl from "../../../components/AnswerControl";
import { HouseContext } from "../../../components/context";

const criterion = {
  id: "year",
  key: "A05",
  sectionId: "general",
  type: "number",
  unit: "year",
  importance: "information",
  label: { en: "Building year" },
};
const initial = {
  id: "answer",
  apartmentId: "apartment",
  criterionId: "year",
  state: "not_checked",
  value: null,
  suitability: "unassessed",
  revision: 1,
};

function Harness() {
  const [existing, setExisting] = useState(initial);
  const controls = (window.answerDraft ??= { saves: [] });
  controls.broadcast = (patch) => setExisting({ ...initial, ...patch });
  return (
    <HouseContext.Provider
      value={{
        locale: "en",
        editable: true,
        snapshot: {
          collection: { revision: 1 },
          sections: [{ id: "general", key: "A" }],
          answers: [existing],
        },
        answer: async (_apartment, _criterion, payload) => {
          await new Promise((resolve) => {
            controls.saves.push({ payload, resolve });
          });
        },
        online: false,
      }}
    >
      <AnswerControl apartmentId="apartment" criterion={criterion} />
    </HouseContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<Harness />);
