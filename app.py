from flask import Flask, jsonify, request, render_template

from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///lostdata.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
from datetime import datetime  # add this import at the top

class LostItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    location = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(10), default="lost")  # "lost" or "found"

    def __repr__(self):
        return f"<LostItem {self.title}>"

# def add_item():
#     item = LostItem(
#         title="Black Wallet",
#         description="Leather wallet with ID cards",
#         location="Library"
#     )
@app.route("/items", methods=["GET"])
def get_items():
    try:
        items = LostItem.query.order_by(LostItem.created_at.desc()).all()

        result = []
        for item in items:
         result.append({
              "id": item.id,
               "title": item.title,
            "description": item.description,
              "location": item.location,
            "created_at": item.created_at.isoformat(),
            "status": item.status
            })


        return jsonify({"items": result}), 200

    except Exception as e:
        print(e)
        return jsonify({"error": "Failed to fetch items"}), 500



@app.route("/add", methods=["POST"])
def add_item():
    data = request.get_json(silent=True)
    status = data.get("status", "lost")
    if status not in ["lost", "found"]:
      return jsonify({"error": "status must be 'lost' or 'found'"}), 400

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    title = data.get("title")
    if not title:
        return jsonify({"error": "Title is required"}), 400

    description = data.get("description", "")
    location = data.get("location", "")

    try:
        item = LostItem(
        title=title,
        description=description,
        location=location,
        status=status
          )

        db.session.add(item)
        db.session.commit()

        return jsonify({
            "message": "Item added successfully",
            "id": item.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"error": "Failed to add item"}), 500

# temporary
@app.route("/debug")
def debug():
    return jsonify({
        "method": request.method,
        "content_type": request.content_type
    })
@app.route("/update-item/<int:item_id>", methods=["PUT"])
def update_item(item_id):
    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"error": "Request body must be JSON"}), 400

    item = LostItem.query.get(item_id)
    if not item:
        return jsonify({"error": "Item not found"}), 404

    # Only update fields if they are present in JSON
    if "title" in data:
        if not data["title"]:
            return jsonify({"error": "Title cannot be empty"}), 400
        item.title = data["title"]

    if "description" in data:
        item.description = data["description"]

    if "location" in data:
        item.location = data["location"]

    if "status" in data:
        new_status = data["status"]
        if new_status not in ["lost", "found"]:
            return jsonify({"error": "status must be 'lost' or 'found'"}), 400
        item.status = new_status

    db.session.commit()
    return jsonify({"message": "Item updated successfully"})

@app.route("/delete-item/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    item = LostItem.query.get(item_id)

    if not item:
        return jsonify({"error": "Item not found"}), 404

    db.session.delete(item)
    db.session.commit()

    return jsonify({"message": "Item deleted successfully"})
@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
 
    app.run(debug=True)
