from pydantic import BaseModel
from typing import List

class QuestionCreate(BaseModel):
    category: str
    question: str
    expected_answer: str
    hints: str

class RoundQuestionCreate(BaseModel):
    question_id: int
    value: int

class RoundCategoryCreate(BaseModel):
    category: str
    questions: List[RoundQuestionCreate]

class RoundCreate(BaseModel):
    round_number: int
    categories: List[RoundCategoryCreate]


class GameFullCreate(BaseModel):
    name: str
    rounds: List[RoundCreate]