from fastapi import FastAPI, HTTPException
from .db import get_db, Question, Game, Round, RoundQuestion
from .model import QuestionCreate, GameFullCreate

from sqlalchemy.exc import ProgrammingError
from sqlalchemy import inspect

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for now (dev only)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def table_exists(db, table_name: str) -> bool:
    inspector = inspect(db.bind)
    return table_name in inspector.get_table_names()

@app.get("/questions")
def get_questions():    
    with get_db() as db:
        if table_exists(db, "questions"):
            return db.query(Question).all()
        else:
            return []

@app.post("/questions")
def create_question(q: QuestionCreate):
    with get_db() as db:
        question = Question(
            category=q.category,
            question=q.question,
            expected_answer=q.expected_answer,
            hints=q.hints

        )
        db.add(question)
        db.commit()
        db.refresh(question)
        return question
    
@app.delete("/questions/{id}")
def delete_question(id: int):
    with get_db() as db:
        question = db.query(Question).filter(Question.id == id).first()

        if question:
            db.delete(question)
            db.commit()

        return {"status": "deleted"}


@app.put("/questions/{id}")
def update_question(id: int, q: QuestionCreate):
    """
    Update a question in place (preserves id and all foreign-key references
    from round_questions, so games containing this question stay intact).
    """
    with get_db() as db:
        question = db.query(Question).filter(Question.id == id).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        question.category = q.category
        question.question = q.question
        question.expected_answer = q.expected_answer
        question.hints = q.hints

        db.commit()
        db.refresh(question)
        return question


@app.get("/games")
def get_games():
    with get_db() as db:
        if table_exists(db, "games"):
            return db.query(Game).all()
        else:
            return []


@app.get("/rounds/{game_id}")
def get_rounds(game_id: int):
    with get_db() as db:
        if table_exists(db, "rounds"):
            return db.query(Round).filter(Round.game_id == game_id).all()
        else:
            return []


@app.get("/round-questions/{round_id}")
def get_round_questions(round_id: int):
    with get_db() as db:
        return db.query(RoundQuestion).filter(
            RoundQuestion.round_id == round_id
        ).all()
    
@app.post("/games/full")
def create_full_game(payload: GameFullCreate):
    with get_db() as db:
        try:
            game = Game(name=payload.name)
            db.add(game)
            db.flush()  

            for r in payload.rounds:
                round_obj = Round(
                    game_id=game.id,
                    round_number=r.round_number
                )
                db.add(round_obj)
                db.flush()

                for cat in r.categories:
                    for q in cat.questions:
                        rq = RoundQuestion(
                            round_id=round_obj.id,
                            question_id=q.question_id,
                            value=q.value
                        )
                        db.add(rq)

            db.commit()
            db.refresh(game)

            return {"game_id": game.id, "status": "created"}

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))


@app.put("/games/{game_id}/full")
def update_full_game(game_id: int, payload: GameFullCreate):
    """
    Replace a game's contents (name + rounds + round_questions).
    Question rows are NOT touched — only the linkage is rebuilt.
    """
    with get_db() as db:
        try:
            game = db.query(Game).filter(Game.id == game_id).first()
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")

            game.name = payload.name

            # Wipe existing rounds + their round_questions
            existing_rounds = db.query(Round).filter(Round.game_id == game_id).all()
            for r in existing_rounds:
                db.query(RoundQuestion).filter(RoundQuestion.round_id == r.id).delete()
            db.query(Round).filter(Round.game_id == game_id).delete()
            db.flush()

            # Recreate from payload
            for r in payload.rounds:
                round_obj = Round(
                    game_id=game_id,
                    round_number=r.round_number
                )
                db.add(round_obj)
                db.flush()

                for cat in r.categories:
                    for q in cat.questions:
                        rq = RoundQuestion(
                            round_id=round_obj.id,
                            question_id=q.question_id,
                            value=q.value
                        )
                        db.add(rq)

            db.commit()
            db.refresh(game)
            return {"game_id": game.id, "status": "updated"}

        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))


@app.delete("/games/{game_id}")
def delete_game(game_id: int):
    """Delete a game and all its rounds + round_questions."""
    with get_db() as db:
        try:
            game = db.query(Game).filter(Game.id == game_id).first()
            if not game:
                return {"status": "not_found"}

            rounds_for_game = db.query(Round).filter(Round.game_id == game_id).all()
            for r in rounds_for_game:
                db.query(RoundQuestion).filter(RoundQuestion.round_id == r.id).delete()
            db.query(Round).filter(Round.game_id == game_id).delete()
            db.delete(game)
            db.commit()
            return {"status": "deleted"}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/games/{game_id}/board")
def get_game_board(game_id: int):
    """
    Returns full game board data needed for rendering:
    rounds -> categories (in insertion order) -> questions (sorted by value asc).
    """
    with get_db() as db:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        rounds = (
            db.query(Round)
            .filter(Round.game_id == game_id)
            .order_by(Round.round_number)
            .all()
        )

        result = {
            "id": game.id,
            "name": game.name,
            "rounds": []
        }

        for r in rounds:
            rqs = (
                db.query(RoundQuestion)
                .filter(RoundQuestion.round_id == r.id)
                .order_by(RoundQuestion.id)
                .all()
            )

            # Group by category, preserving insertion order (== creation order
            # in the editor, which is what the host picked).
            categories = {}
            for rq in rqs:
                q = db.query(Question).filter(Question.id == rq.question_id).first()
                if not q:
                    continue
                cat = q.category
                if cat not in categories:
                    categories[cat] = []
                categories[cat].append({
                    "round_question_id": rq.id,
                    "question_id": q.id,
                    "category": q.category,
                    "question": q.question,
                    "expected_answer": q.expected_answer,
                    "hints": q.hints,
                    "value": rq.value
                })

            for cat in categories:
                categories[cat].sort(key=lambda x: x["value"])

            result["rounds"].append({
                "round_id": r.id,
                "round_number": r.round_number,
                "categories": [
                    {"category": cat, "questions": qs}
                    for cat, qs in categories.items()
                ]
            })

        return result
