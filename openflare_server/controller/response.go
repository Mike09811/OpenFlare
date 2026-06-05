package controller

import (
	"encoding/json"
	"errors"
	"io"
	"strconv"

	"github.com/gin-gonic/gin"

	"openflare/common/response"
)

func respondSuccess(c *gin.Context, data any) {
	response.RespondSuccess(c, data)
}

func respondSuccessWithExtras(c *gin.Context, data any, extras gin.H) {
	response.RespondSuccessWithExtras(c, data, extras)
}

func respondSuccessMessage(c *gin.Context, message string) {
	response.RespondSuccessMessage(c, message)
}

func respondFailure(c *gin.Context, message string) {
	response.RespondFailure(c, message)
}

func respondBadRequest(c *gin.Context, message string) {
	response.RespondBadRequest(c, message)
}

func respondUnauthorized(c *gin.Context, message string) {
	response.RespondUnauthorized(c, message)
}

func decodeJSONBody(body io.Reader, target any) error {
	return json.NewDecoder(body).Decode(target)
}

func decodeOptionalJSONBody(body io.Reader, target any) error {
	if err := json.NewDecoder(body).Decode(target); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	return nil
}

func parseIDParam(c *gin.Context) (uint, bool) {
	return parseIDParamByName(c, "id")
}

func parseIDParamByName(c *gin.Context, name string) (uint, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || id == 0 {
		respondBadRequest(c, "")
		return 0, false
	}
	return uint(id), true
}

func bindJSON(c *gin.Context, target any) bool {
	if err := decodeJSONBody(c.Request.Body, target); err != nil {
		respondBadRequest(c, "")
		return false
	}
	return true
}
